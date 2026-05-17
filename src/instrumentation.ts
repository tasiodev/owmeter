export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { createScanWorker } = await import("@/infrastructure/queue/scanQueue");
    const { initZapMaintenanceWorker } = await import("@/infrastructure/queue/zapMaintenanceQueue");

    const scanWorker = createScanWorker();
    const { worker: maintenanceWorker, queue: maintenanceQueue } = initZapMaintenanceWorker();

    scanWorker.on("failed", (job, err) => {
      console.error(`Scan job ${job?.id} failed:`, err);
    });

    const shutdown = async () => {
      await Promise.all([scanWorker.close(), maintenanceWorker.close(), maintenanceQueue.close()]);
      process.exit(0);
    };

    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  }
}
