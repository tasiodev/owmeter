import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { runPassiveAnalysis } from "@/infrastructure/scanning/PassiveAnalyzer";
import { runZapActiveScan } from "@/infrastructure/scanning/ZapClient";
import { calculateScore } from "@/domain/services/ScoringService";
import type { RawFinding, ScanMode } from "@/domain/services/ScoringService";
import { runSourceCodeAnalysis } from "@/infrastructure/scanning/SourceCodeAnalyzer";
import { fetchRepoAsZip } from "@/infrastructure/scanning/RepoFetcher";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { createLogger } from "@/infrastructure/logger";

const logger = createLogger("ScanWorker");

async function assertReachable(targetUrl: string): Promise<void> {
  try {
    await fetch(targetUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    // Any HTTP response (even 4xx/5xx) means the server is alive
  } catch (err) {
    const reason = err instanceof Error ? err.message : "connection refused";
    throw new Error(`Target ${targetUrl} is not reachable: ${reason}`);
  }
}

// ─── Job data types ───────────────────────────────────────────────────────────

export type PassiveScanJobData = {
  scanId: string;
  targetUrl: string;
  type: "PASSIVE";
};

export type FullScanJobData = {
  scanId: string;
  targetUrl: string;
  type: "FULL";
  repoUrl: string;
};

export type CodeScanJobData = {
  scanId: string;
  type: "CODE";
  repoUrl: string;
};

export type FullZipScanJobData = {
  scanId: string;
  targetUrl: string;
  type: "FULL_ZIP";
  sastFindings: RawFinding[];
};

export type ScanJobData = PassiveScanJobData | FullScanJobData | CodeScanJobData | FullZipScanJobData;

// ─── Deduplication ───────────────────────────────────────────────────────────

const CANONICAL_TITLES: Record<string, string> = {
  "Content Security Policy (CSP) Header Not Set": "Missing Content-Security-Policy header",
  "Missing Anti-clickjacking Header": "Missing X-Frame-Options header",
  "X-Frame-Options Header Not Set": "Missing X-Frame-Options header",
  "Strict-Transport-Security Header Not Set": "Missing Strict-Transport-Security (HSTS) header",
  "X-Content-Type-Options Header Missing": "Missing X-Content-Type-Options header",
};

export function deduplicateFindings(findings: RawFinding[]): RawFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const canonical = CANONICAL_TITLES[f.title] ?? f.title;
    const key = `${f.category}:${canonical}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Redis / Queue ────────────────────────────────────────────────────────────

function getRedisConnection() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6380", {
    maxRetriesPerRequest: null,
  });
}

let _queue: Queue<ScanJobData> | null = null;

export function getScanQueue(): Queue<ScanJobData> {
  if (!_queue) {
    _queue = new Queue<ScanJobData>("scans", { connection: getRedisConnection() });
  }
  return _queue;
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function createScanWorker(): Worker<ScanJobData> {
  const repo = new PrismaScanRepository();

  return new Worker<ScanJobData>(
    "scans",
    async (job: Job<ScanJobData>) => {
      const { scanId } = job.data;

      await repo.updateStatus(scanId, "RUNNING");

      try {
        let allRawFindings: RawFinding[];
        let scanMode: ScanMode;

        if (job.data.type === "CODE") {
          // Code-only scan for CODE_REPO projects
          const zipBuffer = await fetchRepoAsZip(job.data.repoUrl);
          allRawFindings = deduplicateFindings(await runSourceCodeAnalysis(zipBuffer));
          scanMode = "CODE";
        } else if (job.data.type === "FULL_ZIP") {
          // Full scan with pre-analyzed SAST findings from user-uploaded ZIP
          const { targetUrl, sastFindings } = job.data;

          await assertReachable(targetUrl).catch((err: unknown) => {
            const reason = err instanceof Error ? err.message : "unreachable";
            logger.error({ scanId, targetUrl, reason }, "Target not reachable — aborting scan");
            throw err;
          });

          const [passiveFindings, zapFindings] = await Promise.all([
            runPassiveAnalysis(targetUrl),
            runZapActiveScan(targetUrl),
          ]);

          allRawFindings = deduplicateFindings([...passiveFindings, ...zapFindings, ...sastFindings]);
          scanMode = "FULL";
        } else {
          // Passive or Full scan for WEBSITE projects
          const { targetUrl } = job.data;

          await assertReachable(targetUrl).catch((err: unknown) => {
            const reason = err instanceof Error ? err.message : "unreachable";
            logger.error({ scanId, targetUrl, reason }, "Target not reachable — aborting scan");
            throw err;
          });

          // For FULL scans: fetch repo ZIP before running website analysis so an
          // inaccessible repo fails fast rather than after wasting ZAP scan time.
          let repoZip: Uint8Array | undefined;
          if (job.data.type === "FULL") {
            const { repoUrl } = job.data;
            repoZip = await fetchRepoAsZip(repoUrl).catch((err: unknown) => {
              const reason = err instanceof Error ? err.message : "unknown";
              logger.error({ scanId, repoUrl, reason }, "Repo not accessible — aborting scan");
              throw err;
            });
          }

          const [passiveFindings, zapFindings] = await Promise.all([
            runPassiveAnalysis(targetUrl),
            runZapActiveScan(targetUrl),
          ]);

          const combined: RawFinding[] = [...passiveFindings, ...zapFindings];

          if (job.data.type === "FULL" && repoZip) {
            const sastFindings = await runSourceCodeAnalysis(repoZip);
            combined.push(...sastFindings);
            scanMode = "FULL";
          } else {
            scanMode = "PASSIVE";
          }

          allRawFindings = deduplicateFindings(combined);
        }

        const { score, maxScore, findings: scoredFindings } = calculateScore(allRawFindings, scanMode);
        await repo.complete(scanId, score, maxScore, scoredFindings);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        await repo.updateStatus(scanId, "FAILED", errorMessage);
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}
