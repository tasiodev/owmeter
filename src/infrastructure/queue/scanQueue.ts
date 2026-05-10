import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { runPassiveAnalysis } from "@/infrastructure/scanning/PassiveAnalyzer";
import { runZapActiveScan } from "@/infrastructure/scanning/ZapClient";
import { calculateScore } from "@/domain/services/ScoringService";
import type { RawFinding } from "@/domain/services/ScoringService";
import { runSourceCodeAnalysis } from "@/infrastructure/scanning/SourceCodeAnalyzer";
import { verifyCodeMatchesSite } from "@/infrastructure/scanning/CodeVerifier";
import { fetchGitHubRepoAsZip } from "@/infrastructure/scanning/GitHubFetcher";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";

// ─── Job data types ───────────────────────────────────────────────────────────

export type BasicScanJobData = {
  scanId: string;
  targetUrl: string;
  type: "BASIC";
};

export type CompleteScanZipJobData = {
  scanId: string;
  targetUrl: string;
  type: "COMPLETE";
  sourceZip: string; // base64-encoded Uint8Array
};

export type CompleteScanGitHubJobData = {
  scanId: string;
  targetUrl: string;
  type: "COMPLETE";
  githubUrl: string;
};

export type ScanJobData =
  | BasicScanJobData
  | CompleteScanZipJobData
  | CompleteScanGitHubJobData;

// ─── SAST gating ─────────────────────────────────────────────────────────────

export class VerificationError extends Error {
  constructor() {
    super("Source code could not be verified as belonging to this site");
  }
}

/** Verifies ownership and appends SAST findings to `combined`. Throws VerificationError if not verified. */
export async function applySastFindings(
  combined: RawFinding[],
  zipBuffer: Uint8Array,
  targetUrl: string,
  detectedFramework: string | null
): Promise<void> {
  const verification = await verifyCodeMatchesSite(zipBuffer, targetUrl, detectedFramework);

  if (!verification.verified) {
    throw new VerificationError();
  }

  const sastFindings = await runSourceCodeAnalysis(zipBuffer);
  combined.push(...sastFindings);
}

// ─── Deduplication ───────────────────────────────────────────────────────────

// Maps known ZAP alert names to their PassiveAnalyzer equivalents so the
// category:title dedup key collapses findings that describe the same issue.
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

// ─── Framework detection helper ───────────────────────────────────────────────

function detectFrameworkFromFindings(findings: RawFinding[]): string | null {
  const serverInfoFinding = findings.find(
    (f) => f.title.includes("x-powered-by") && f.evidence
  );
  return serverInfoFinding?.evidence ?? null;
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
      const { scanId, targetUrl } = job.data;

      await repo.updateStatus(scanId, "RUNNING");

      try {
        // Step 1: Always run passive + ZAP
        const [passiveResult, zapResult] = await Promise.allSettled([
          runPassiveAnalysis(targetUrl),
          runZapActiveScan(targetUrl),
        ]);

        const combined: RawFinding[] = [
          ...(passiveResult.status === "fulfilled" ? passiveResult.value : []),
          ...(zapResult.status === "fulfilled" ? zapResult.value : []),
        ];

        // Step 2: SAST analysis for COMPLETE scans
        if (job.data.type === "COMPLETE") {
          let zipBuffer: Uint8Array;

          if ("sourceZip" in job.data) {
            zipBuffer = new Uint8Array(Buffer.from(job.data.sourceZip, "base64"));
          } else {
            zipBuffer = await fetchGitHubRepoAsZip(job.data.githubUrl);
          }

          const detectedFramework = detectFrameworkFromFindings(combined);
          await applySastFindings(combined, zipBuffer, targetUrl, detectedFramework);

          // Explicit dereference to allow GC
           
          zipBuffer = new Uint8Array(0);
        }

        // Step 3: Deduplicate, score, and persist
        const allRawFindings = deduplicateFindings(combined);
        const scanMode = job.data.type === "COMPLETE" ? "COMPLETE" : "BASIC";
        const { score, maxScore, findings: scoredFindings } = calculateScore(allRawFindings, scanMode);

        await repo.complete(scanId, score, maxScore, scoredFindings);
      } catch (err) {
        if (err instanceof VerificationError) {
          await repo.invalidate(
            scanId,
            "Source code could not be verified as belonging to this site. Upload the source code for the correct domain."
          );
        } else {
          await repo.updateStatus(scanId, "FAILED");
        }
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}
