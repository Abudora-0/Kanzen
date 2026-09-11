import type { ProviderId } from '@kanzen/shared';
import type { Types } from 'mongoose';
import { workerEnabled } from '../env.js';
import { logger } from '../logger.js';
import { SyncRun, type ConnectionDoc } from '../models/index.js';
import { enqueueSync } from '../queue/queues.js';
import { refreshInsightSnapshot } from '../insights/compute.js';
import { publishEvent } from '../events/bus.js';
import { runSync } from './engine.js';

type DispatchInput = {
  connection: ConnectionDoc;
  mode: 'full' | 'incremental';
};

/**
 * Inline syncs (no jobId) run inside a single Vercel function invocation,
 * which is hard killed at its execution time limit (see the api/index.ts
 * maxDuration in vercel.json) with no chance to update the SyncRun. A run
 * still "running" past that limit plus a safety margin cannot be real; it
 * was killed. Worker-dispatched runs (jobId set) are excluded: they have no
 * such external kill, and BullMQ's own attempts/backoff plus processSync's
 * failure handling (apps/api/src/worker/run.ts) already settle them.
 */
const STALE_RUN_MS = 320_000;

/** Mark inline runs the platform killed mid-flight as failed instead of
 * leaving them stuck "running" forever. Scoped by an arbitrary Mongo filter
 * so callers can reap for one connection (before dispatching) or a whole
 * user (on page load). A bulk update alone never reaches the browser, so a
 * reaped run's live "syncing" state stuck around forever with no terminal
 * event to clear it; each affected run gets its own sync:state event too. */
export async function reapStaleSyncRuns(filter: Record<string, unknown>): Promise<void> {
  const stale = await SyncRun.find({
    ...filter,
    jobId: null,
    state: { $in: ['queued', 'running'] },
    updatedAt: { $lt: new Date(Date.now() - STALE_RUN_MS) },
  }).select('_id userId provider');
  if (stale.length === 0) return;

  await SyncRun.updateMany(
    { _id: { $in: stale.map((run) => run._id) } },
    {
      $set: {
        state: 'failed',
        finishedAt: new Date(),
        error: 'Timed out (exceeded the serverless function limit)',
      },
    },
  );
  await Promise.all(
    stale.map((run) =>
      publishEvent(String(run.userId), {
        type: 'sync:state',
        provider: run.provider as ProviderId,
        runId: String(run._id),
        state: 'failed',
      }),
    ),
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
    try {
      const job = await enqueueWithRetry({
        userId: String(connection.userId),
        connectionId: String(connection._id),
        provider: connection.provider as ProviderId,
        mode,
        syncRunId,
      });
      await SyncRun.updateOne({ _id: syncRunId }, { $set: { jobId: job.id ?? null } });
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, provider: connection.provider },
        'enqueue failed after retries, running sync inline',
      );
      await runInline(connection, mode, syncRunId);
    }
    return run;
  }

  await runInline(connection, mode, syncRunId);
  return run;
}

/**
 * A transient Redis blip on enqueue used to fall straight through to running
 * the sync inline, bound by Vercel's request time limit instead of the
 * worker's unbounded one, for no better reason than a single failed attempt.
 * Retry a couple of times first since the blip is usually gone a moment later.
 */
async function enqueueWithRetry(job: Parameters<typeof enqueueSync>[0], attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await enqueueSync(job);
    } catch (err) {
      if (attempt === attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  throw new Error('unreachable');
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
    await publishEvent(String(connection.userId), {
      type: 'sync:state',
      provider: connection.provider as ProviderId,
      runId: syncRunId,
      state: 'failed',
    }).catch(() => undefined);
  }
}
