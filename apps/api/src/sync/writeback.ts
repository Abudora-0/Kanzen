import type { ExternalIds, ProviderId } from '@kanzen/shared';
import { workerEnabled } from '../env.js';
import { logger } from '../logger.js';
import { Connection, Entry, Work } from '../models/index.js';
import { buildSyncContext, registry } from '../providers/context.js';
import { withProviderLimit } from '../ratelimit/limiter.js';
import { enqueueWriteback } from '../queue/queues.js';
import { refreshInsightSnapshot } from '../insights/compute.js';

/**
 * Push every dirty source of an entry back to its provider. Shared by the BullMQ
 * worker and the inline path, so local edits reach AniList / MAL / Kitsu / TMDB
 * whether or not a worker process is running.
 */
export async function runWriteback(entryId: string): Promise<{ pushed: number }> {
  const entry = await Entry.findById(entryId);
  if (!entry) return { pushed: 0 };
  const work = await Work.findById(entry.workId);
  if (!work) return { pushed: 0 };

  let pushed = 0;
  for (const source of entry.sources) {
    if (!source.dirty) continue;
    const connection = await Connection.findOne({
      userId: entry.userId,
      provider: source.provider,
    });
    if (!connection || connection.get('demo')) continue;

    const provider = registry.get(source.provider as ProviderId);
    const ctx = buildSyncContext(connection, { mode: 'incremental' });
    if (ctx.demo) continue;

    const externalWorkId = String(
      work.externalIds?.[source.provider as keyof ExternalIds] ?? work.externalIds?.anilist ?? '',
    );
    if (!externalWorkId) continue;

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
      pushed += 1;
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, provider: source.provider },
        'writeback failed for one source',
      );
      // Keep the source dirty so a later sync or retry picks it up.
    }
  }

  await entry.save();
  return { pushed };
}

/**
 * Queue the writeback when a worker is running, otherwise run it inline (and
 * refresh insights, which the worker would otherwise do).
 */
export async function dispatchWriteback(userId: string, entryId: string): Promise<void> {
  if (workerEnabled) {
    await enqueueWriteback({ userId, entryId }).catch(async (err) => {
      logger.warn({ err: (err as Error).message }, 'enqueue writeback failed, running inline');
      await runWriteback(entryId);
    });
    return;
  }
  await runWriteback(entryId).catch((err) =>
    logger.warn({ err: (err as Error).message }, 'inline writeback failed'),
  );
  await refreshInsightSnapshot(userId).catch(() => undefined);
}
