import { createApp } from './app.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { connectMongo } from './db/mongo.js';
import { scheduleTokenRefresh } from './queue/queues.js';
import { startWorkers } from './worker/run.js';

async function main() {
  await connectMongo();
  const app = createApp();

  const server = app.listen(env.API_PORT, () => {
    logger.info(`Kanzen API listening on http://localhost:${env.API_PORT}`);
  });

  // Convenience for local dev: run the queue workers in the same process.
  if (env.ROLE === 'all') {
    await startWorkers();
    await scheduleTokenRefresh().catch(() => undefined);
    logger.info('queue workers started in-process (ROLE=all)');
  }

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'failed to start API');
  process.exit(1);
});
