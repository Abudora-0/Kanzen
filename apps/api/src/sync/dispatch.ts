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
 * Create a SyncRun and either hand it to the BullMQ worker or, when no worker
 * is running, execute it inline. The inline path keeps the deployment free of a
 * separate long lived process at the cost of a longer request for big libraries.
 */
export async function dispatchSync({ connection, mode }: DispatchInput) {
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
