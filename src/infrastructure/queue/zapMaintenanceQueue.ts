import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";
import { updateZapAddons } from "@/infrastructure/scanning/ZapClient";

const logger = pino({ name: "ZapMaintenanceWorker" });
const QUEUE_NAME = "zap-maintenance";
const EVERY_24H_MS = 24 * 60 * 60 * 1000;

function getRedisConnection() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6380", {
    maxRetriesPerRequest: null,
  });
}

export function initZapMaintenanceWorker(): { worker: Worker; queue: Queue } {
  const queue = new Queue(QUEUE_NAME, { connection: getRedisConnection() });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await updateZapAddons();
    },
    { connection: getRedisConnection(), concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "ZAP addon update job failed");
  });

  // Daily repeatable job — upsert so restarts don't create duplicates.
  queue
    .upsertJobScheduler("zap-addon-update-daily", { every: EVERY_24H_MS }, { name: "update-addons", data: {} })
    .catch((err) => logger.error({ err }, "Failed to schedule daily ZAP addon update"));

  // Immediate startup job — jobId deduplicates if the process restarts quickly.
  queue
    .add("update-addons", {}, { jobId: "zap-addon-update-startup" })
    .catch((err) => logger.error({ err }, "Failed to enqueue startup ZAP addon update"));

  return { queue, worker };
}
