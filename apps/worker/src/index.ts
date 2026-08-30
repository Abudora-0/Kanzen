import { startWorkers, stopWorkers, connectMongo } from '@kanzen/api';

async function main() {
  await connectMongo();
  await startWorkers();
  console.log('[kanzen worker] processing sync, writeback, insights, and token-refresh queues');

  const shutdown = async (signal: string) => {
    console.log(`[kanzen worker] ${signal} received, draining`);
    await stopWorkers();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[kanzen worker] failed to start', err);
  process.exit(1);
});
