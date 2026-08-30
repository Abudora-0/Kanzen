import { Queue, QueueEvents, type JobsOptions } from 'bullmq';
import type { ProviderId } from '@kanzen/shared';
import { createRedisConnection } from '../redis/redis.js';
import { logger } from '../logger.js';

export const QUEUE_NAMES = {
  sync: 'kanzen:sync',
  writeback: 'kanzen:writeback',
  insights: 'kanzen:insights',
  tokenRefresh: 'kanzen:token-refresh',
} as const;

export type SyncJob = {
  userId: string;
  connectionId: string;
  provider: ProviderId;
  mode: 'full' | 'incremental';
  syncRunId: string;
};

export type WritebackJob = {
  userId: string;
  entryId: string;
};

export type InsightsJob = {
  userId: string;
  reason: 'sync' | 'manual' | 'edit';
};

export type TokenRefreshJob = { sweep: true };

const defaultJobOptions: JobsOptions = {
  attempts: 4,
  backoff: { type: 'exponential', delay: 4000 },
  removeOnComplete: { count: 200, age: 60 * 60 * 24 },
  removeOnFail: { count: 500 },
};

let queues: {
  sync: Queue<SyncJob>;
  writeback: Queue<WritebackJob>;
  insights: Queue<InsightsJob>;
  tokenRefresh: Queue<TokenRefreshJob>;
  syncEvents: QueueEvents;
} | null = null;

export function getQueues() {
  if (!queues) {
    const connection = createRedisConnection();
    queues = {
      sync: new Queue(QUEUE_NAMES.sync, { connection, defaultJobOptions }),
      writeback: new Queue(QUEUE_NAMES.writeback, { connection, defaultJobOptions }),
      insights: new Queue(QUEUE_NAMES.insights, {
        connection,
        defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
      }),
      tokenRefresh: new Queue(QUEUE_NAMES.tokenRefresh, { connection, defaultJobOptions }),
      syncEvents: new QueueEvents(QUEUE_NAMES.sync, { connection: createRedisConnection() }),
    };
    logger.info('bullmq queues ready');
  }
  return queues;
}

export async function enqueueSync(job: SyncJob) {
  return getQueues().sync.add('sync', job, { jobId: `sync:${job.syncRunId}` });
}

export async function enqueueWriteback(job: WritebackJob) {
  return getQueues().writeback.add('writeback', job, {
    jobId: `wb:${job.entryId}`,
    delay: 2500,
  });
}

export async function enqueueInsights(job: InsightsJob) {
  return getQueues().insights.add('insights', job, {
    jobId: `insights:${job.userId}`,
    delay: 1500,
  });
}

/** Repeatable sweep that refreshes provider tokens before they expire. */
export async function scheduleTokenRefresh() {
  return getQueues().tokenRefresh.add(
    'sweep',
    { sweep: true },
    { repeat: { every: 1000 * 60 * 30 }, jobId: 'token-refresh-sweep' },
  );
}

export async function closeQueues() {
  if (!queues) return;
  await Promise.allSettled([
    queues.sync.close(),
    queues.writeback.close(),
    queues.insights.close(),
    queues.tokenRefresh.close(),
    queues.syncEvents.close(),
  ]);
  queues = null;
}
