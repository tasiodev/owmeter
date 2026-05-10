export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { createScanWorker } = await import("@/infrastructure/queue/scanQueue");
    const worker = createScanWorker();

    worker.on("failed", (job, err) => {
      console.error(`Scan job ${job?.id} failed:`, err);
    });

    const shutdown = async () => {
      await worker.close();
      process.exit(0);
    };

    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  }
}
