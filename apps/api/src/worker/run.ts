import { Worker, type Job } from 'bullmq';
import type { ProviderId } from '@kanzen/shared';
import { createRedisConnection } from '../redis/redis.js';
import { connectMongo } from '../db/mongo.js';
import { logger } from '../logger.js';
import { demoMode } from '../env.js';
import {
  QUEUE_NAMES,
  type InsightsJob,
  type SyncJob,
  type TokenRefreshJob,
  type WritebackJob,
} from '../queue/queues.js';
import { Connection, Entry, SyncRun, Work } from '../models/index.js';
import { runSync } from '../sync/engine.js';
import { refreshInsightSnapshot } from '../insights/compute.js';
import { buildSyncContext, decryptTokens, persistTokens, registry } from '../providers/context.js';
import { withProviderLimit } from '../ratelimit/limiter.js';
import { publishEvent } from '../events/bus.js';

let workers: Worker[] = [];

async function processSync(job: Job<SyncJob>) {
  const { connectionId, mode, syncRunId } = job.data;
  const connection = await Connection.findById(connectionId);
  if (!connection) throw new Error(`connection ${connectionId} gone`);

  try {
    const stats = await runSync({
      connection,
      mode,
      syncRunId,
      onProgress: (done, total) => void job.updateProgress(Math.round((done / total) * 100)),
    });
    await refreshInsightSnapshot(String(connection.userId)).catch((err) =>
      logger.warn({ err: err.message }, 'post-sync insights refresh failed'),
    );
    await publishEvent(String(connection.userId), {
      type: 'insights:ready',
      generatedAt: new Date().toISOString(),
    });
    return stats;
  } catch (err) {
    await SyncRun.updateOne(
      { _id: syncRunId },
      { $set: { state: 'failed', finishedAt: new Date(), error: (err as Error).message } },
    );
    await Connection.updateOne(
      { _id: connectionId },
      { $set: { status: 'error', error: (err as Error).message } },
    );
    await publishEvent(String(connection.userId), {
      type: 'sync:state',
      provider: connection.provider as ProviderId,
      runId: syncRunId,
      state: 'failed',
    });
    throw err;
  }
}

async function processWriteback(job: Job<WritebackJob>) {
  if (demoMode) return { skipped: 'demo' };
  const entry = await Entry.findById(job.data.entryId);
  if (!entry) return { skipped: 'missing' };
  const work = await Work.findById(entry.workId);
  if (!work) return { skipped: 'missing-work' };

  for (const source of entry.sources) {
    if (!source.dirty) continue;
    const connection = await Connection.findOne({
      userId: entry.userId,
      provider: source.provider,
    });
    if (!connection) continue;
    const provider = registry.get(source.provider as ProviderId);
    const ctx = buildSyncContext(connection, { mode: 'incremental' });
    const externalWorkId = String(
      work.externalIds?.[
        source.provider === 'tmdb' ? 'tmdb' : source.provider === 'mal' ? 'mal' : 'anilist'
      ] ??
        work.externalIds?.anilist ??
        '',
    );
    try {
      await withProviderLimit(source.provider as ProviderId, () =>
        provider.updateEntry(ctx, {
          providerEntryId: source.providerEntryId,
          externalWorkId,
          status: entry.status,
          progress: entry.progress,
          score: entry.score ?? null,
        }),
      );
      source.set('dirty', false);
      source.set('status', entry.status);
      source.set('progress', entry.progress);
      source.set('score', entry.score ?? null);
      source.set('syncedAt', new Date());
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, provider: source.provider },
        'writeback failed, will retry',
      );
      throw err;
    }
  }
  await entry.save();
  return { pushed: true };
}

async function processInsights(job: Job<InsightsJob>) {
  const payload = await refreshInsightSnapshot(job.data.userId);
  await publishEvent(job.data.userId, {
    type: 'insights:ready',
    generatedAt: payload.generatedAt,
  });
  return { ok: true };
}

async function processTokenRefresh(_job: Job<TokenRefreshJob>) {
  if (demoMode) return { skipped: 'demo' };
  const soon = Date.now() + 1000 * 60 * 60;
  const connections = await Connection.find({ status: 'active', demo: { $ne: true } });
  let refreshed = 0;
  for (const connection of connections) {
    const tokens = decryptTokens(connection);
    if (!tokens.expiresAt || tokens.expiresAt > soon || !tokens.refreshToken) continue;
    const provider = registry.get(connection.provider as ProviderId);
    try {
      const next = await withProviderLimit(connection.provider as ProviderId, () =>
        provider.refresh(tokens),
      );
      await persistTokens(connection, next);
      refreshed += 1;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'scheduled token refresh failed');
      await Connection.updateOne({ _id: connection._id }, { $set: { status: 'expired' } });
    }
  }
  return { refreshed };
}

/** Start every BullMQ worker. Call once per worker process. */
export async function startWorkers(): Promise<void> {
  await connectMongo();
  const connection = createRedisConnection();

  workers = [
    new Worker<SyncJob>(QUEUE_NAMES.sync, processSync, { connection, concurrency: 4 }),
    new Worker<WritebackJob>(QUEUE_NAMES.writeback, processWriteback, {
      connection,
      concurrency: 3,
    }),
    new Worker<InsightsJob>(QUEUE_NAMES.insights, processInsights, { connection, concurrency: 2 }),
    new Worker<TokenRefreshJob>(QUEUE_NAMES.tokenRefresh, processTokenRefresh, {
      connection,
      concurrency: 1,
    }),
  ];

  for (const worker of workers) {
    worker.on('failed', (job, err) =>
      logger.error({ queue: worker.name, jobId: job?.id, err: err.message }, 'job failed'),
    );
    worker.on('completed', (job) =>
      logger.debug({ queue: worker.name, jobId: job.id }, 'job completed'),
    );
  }
  logger.info('kanzen workers online');
}

export async function stopWorkers(): Promise<void> {
  await Promise.allSettled(workers.map((w) => w.close()));
  workers = [];
}
