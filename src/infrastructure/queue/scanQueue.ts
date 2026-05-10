import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { runPassiveAnalysis } from "@/infrastructure/scanning/PassiveAnalyzer";
import { runZapActiveScan } from "@/infrastructure/scanning/ZapClient";
import { calculateScore } from "@/domain/services/ScoringService";
import type { RawFinding } from "@/domain/services/ScoringService";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";

export interface ScanJobData {
  scanId: string;
  targetUrl: string;
}

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

export function createScanWorker(): Worker<ScanJobData> {
  const repo = new PrismaScanRepository();

  return new Worker<ScanJobData>(
    "scans",
    async (job: Job<ScanJobData>) => {
      const { scanId, targetUrl } = job.data;

      await repo.updateStatus(scanId, "RUNNING");

      try {
        const [passiveResult, zapResult] = await Promise.allSettled([
          runPassiveAnalysis(targetUrl),
          runZapActiveScan(targetUrl),
        ]);

        const combined = [
          ...(passiveResult.status === "fulfilled" ? passiveResult.value : []),
          ...(zapResult.status === "fulfilled" ? zapResult.value : []),
        ];

        const allRawFindings = deduplicateFindings(combined);

        const { score, maxScore, findings: scoredFindings } = calculateScore(allRawFindings);

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
