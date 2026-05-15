import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { runPassiveAnalysis } from "@/infrastructure/scanning/PassiveAnalyzer";
import { runZapActiveScan } from "@/infrastructure/scanning/ZapClient";
import { calculateScore } from "@/domain/services/ScoringService";
import type { RawFinding, ScanMode } from "@/domain/services/ScoringService";
import { runSourceCodeAnalysis } from "@/infrastructure/scanning/SourceCodeAnalyzer";
import { fetchGitHubRepoAsZip } from "@/infrastructure/scanning/GitHubFetcher";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";

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
  githubUrl: string;
};

export type CodeScanJobData = {
  scanId: string;
  type: "CODE";
  githubUrl: string;
};

export type ScanJobData = PassiveScanJobData | FullScanJobData | CodeScanJobData;

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
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
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
          const zipBuffer = await fetchGitHubRepoAsZip(job.data.githubUrl);
          allRawFindings = deduplicateFindings(await runSourceCodeAnalysis(zipBuffer));
          scanMode = "CODE";
        } else {
          // Passive or Full scan for WEBSITE projects
          const { targetUrl } = job.data;
          const [passiveFindings, zapFindings] = await Promise.all([
            runPassiveAnalysis(targetUrl),
            runZapActiveScan(targetUrl),
          ]);

          const combined: RawFinding[] = [...passiveFindings, ...zapFindings];

          if (job.data.type === "FULL") {
            const zipBuffer = await fetchGitHubRepoAsZip(job.data.githubUrl);
            const sastFindings = await runSourceCodeAnalysis(zipBuffer);
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
        await repo.updateStatus(scanId, "FAILED");
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}
