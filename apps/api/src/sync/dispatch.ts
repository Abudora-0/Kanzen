import type { ProviderId } from '@kanzen/shared';
import type { Types } from 'mongoose';
import { workerEnabled } from '../env.js';
import { logger } from '../logger.js';
import { SyncRun, type ConnectionDoc } from '../models/index.js';
import { enqueueSync } from '../queue/queues.js';
import { refreshInsightSnapshot } from '../insights/compute.js';
import { runSync } from './engine.js';

type DispatchInput = {
  connection: ConnectionDoc;
  mode: 'full' | 'incremental';
};

/**
 * Inline syncs run inside a single Vercel function invocation, which is hard
 * killed at its execution time limit (see the api/index.ts maxDuration in
 * vercel.json) with no chance to update the SyncRun. A run still "running"
 * past that limit plus a safety margin cannot be real; it was killed.
 */
const STALE_RUN_MS = 320_000;

/** Mark runs the platform killed mid-flight as failed instead of leaving them
 * stuck "running" forever. Scoped by an arbitrary Mongo filter so callers can
 * reap for one connection (before dispatching) or a whole user (on page load). */
export async function reapStaleSyncRuns(filter: Record<string, unknown>): Promise<void> {
  await SyncRun.updateMany(
    {
      ...filter,
      state: { $in: ['queued', 'running'] },
      updatedAt: { $lt: new Date(Date.now() - STALE_RUN_MS) },
    },
    {
      $set: {
        state: 'failed',
        finishedAt: new Date(),
        error: 'Timed out (exceeded the serverless function limit)',
      },
    },
  );
}

/**
 * Create a SyncRun and either hand it to the BullMQ worker or, when no worker
 * is running, execute it inline. The inline path keeps the deployment free of a
 * separate long lived process at the cost of a longer request for big libraries.
 */
export async function dispatchSync({ connection, mode }: DispatchInput) {
  await reapStaleSyncRuns({ connectionId: connection._id });

  const active = await SyncRun.findOne({
    connectionId: connection._id,
    state: { $in: ['queued', 'running'] },
  }).sort({ createdAt: -1 });
  if (active) return active;

  const run = await SyncRun.create({
    userId: connection.userId,
    connectionId: connection._id,
    provider: connection.provider,
    mode,
    state: 'queued',
  });
  const syncRunId = String((run._id as Types.ObjectId | string) ?? '');

  if (workerEnabled) {
    await enqueueSync({
      userId: String(connection.userId),
      connectionId: String(connection._id),
      provider: connection.provider as ProviderId,
      mode,
      syncRunId,
    }).catch(async (err) => {
      logger.warn({ err: (err as Error).message }, 'enqueue failed, running sync inline');
      await runInline(connection, mode, syncRunId);
    });
    return run;
  }

  await runInline(connection, mode, syncRunId);
  return run;
}

async function runInline(
  connection: ConnectionDoc,
  mode: 'full' | 'incremental',
  syncRunId: string,
) {
  try {
    await runSync({ connection, mode, syncRunId });
    await refreshInsightSnapshot(String(connection.userId));
  } catch (err) {
    logger.error(
      { err: (err as Error).message, provider: connection.provider },
      'inline sync failed',
    );
    await SyncRun.updateOne(
      { _id: syncRunId },
      { $set: { state: 'failed', finishedAt: new Date(), error: (err as Error).message } },
    ).catch(() => undefined);
  }
}
