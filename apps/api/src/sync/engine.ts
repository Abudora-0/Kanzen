import Bottleneck from 'bottleneck';
import type { ProviderId } from '@kanzen/shared';
import type { RawEntry } from '@kanzen/providers';
import { estimateMinutes } from '@kanzen/shared';
import { ActivityLog, Connection, Entry, SyncRun, type ConnectionDoc } from '../models/index.js';
import { buildSyncContext, persistTokens, registry } from '../providers/context.js';
import { withProviderLimit } from '../ratelimit/limiter.js';
import { publishEvent } from '../events/bus.js';
import { invalidate } from '../cache/cache.js';
import { logger } from '../logger.js';
import { demoMode } from '../env.js';
import { resolveWork, linkRelations } from './identity.js';
import { mergeSources } from './merge.js';

export type SyncStats = { fetched: number; created: number; updated: number; conflicts: number };

type RunOptions = {
  connection: ConnectionDoc;
  mode: 'full' | 'incremental';
  syncRunId: string;
  onProgress?: (done: number, total: number) => void;
};

/**
 * Pull one connection's library, reconcile every entry against the canonical
 * catalogue, merge the per provider state, and record progress activity. The
 * queue worker calls this; it is also runnable inline for the cron path.
 */
export async function runSync(opts: RunOptions): Promise<SyncStats> {
  const { connection, mode, syncRunId } = opts;
  const provider = registry.get(connection.provider as ProviderId);
  const ctx = buildSyncContext(connection, { mode });
  const stats: SyncStats = { fetched: 0, created: 0, updated: 0, conflicts: 0 };

  await SyncRun.updateOne(
    { _id: syncRunId },
    { $set: { state: 'running', startedAt: new Date() } },
  );
  await publishEvent(String(connection.userId), {
    type: 'sync:state',
    provider: connection.provider as ProviderId,
    runId: syncRunId,
    state: 'running',
  });

  // Refresh an expiring token before the pull when we hold real credentials.
  if (!demoMode) {
    const tokens = ctx.tokens;
    if (tokens.expiresAt && tokens.expiresAt < Date.now() + 60_000 && tokens.refreshToken) {
      try {
        const next = await withProviderLimit(connection.provider as ProviderId, () =>
          provider.refresh(tokens),
        );
        await persistTokens(connection, next);
        ctx.tokens = next;
      } catch (err) {
        logger.warn({ err: (err as Error).message }, 'token refresh failed before sync');
      }
    }
  }

  const raws: RawEntry[] = [];
  let cursor: string | null | undefined = mode === 'incremental' ? connection.cursor : null;
  do {
    const page = await withProviderLimit(connection.provider as ProviderId, () =>
      provider.fetchLibrary(ctx, cursor),
    );
    raws.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  stats.fetched = raws.length;
  const total = raws.length || 1;
  let done = 0;
  let cancelled = false;

  // Each entry is a handful of sequential Mongo round trips; run them with
  // bounded concurrency so a real library does not blow past the serverless
  // function's execution time limit while running fully one at a time.
  const entryLimiter = new Bottleneck({ maxConcurrent: 8 });
  await Promise.all(
    raws.map((raw) =>
      entryLimiter.schedule(async () => {
        // A separate request may have flagged this run for cancellation; a
        // task not yet started skips its work, one already running finishes.
        if (cancelled) return;

        const work = await resolveWork(raw.work);
        const outcome = await applyEntry(
          String(connection.userId),
          connection.provider as ProviderId,
          work.id,
          raw,
          work,
        );
        if (outcome === 'created') stats.created += 1;
        else stats.updated += 1;
        if (outcome === 'conflict') stats.conflicts += 1;

        done += 1;
        if (done % 10 === 0 || done === raws.length) {
          opts.onProgress?.(done, total);
          await publishEvent(String(connection.userId), {
            type: 'sync:progress',
            provider: connection.provider as ProviderId,
            runId: syncRunId,
            done,
            total,
          });
          if (!cancelled) {
            const fresh = await SyncRun.findById(syncRunId).select('cancelRequested').lean();
            if (fresh?.cancelRequested) cancelled = true;
          }
        }
      }),
    ),
  );

  if (cancelled) {
    await SyncRun.updateOne(
      { _id: syncRunId },
      { $set: { state: 'cancelled', finishedAt: new Date(), stats } },
    );
    await publishEvent(String(connection.userId), {
      type: 'sync:state',
      provider: connection.provider as ProviderId,
      runId: syncRunId,
      state: 'cancelled',
    });
    return stats;
  }

  await linkRelations(raws.map((r) => r.work));

  connection.lastSyncedAt = new Date();
  connection.cursor = null;
  connection.status = 'active';
  await connection.save();

  await SyncRun.updateOne(
    { _id: syncRunId },
    { $set: { state: 'done', finishedAt: new Date(), stats } },
  );
  await Connection.updateOne({ _id: connection._id }, { $set: { error: null } });
  await invalidate(`user:${connection.userId}`);
  await publishEvent(String(connection.userId), {
    type: 'sync:state',
    provider: connection.provider as ProviderId,
    runId: syncRunId,
    state: 'done',
  });

  return stats;
}

async function applyEntry(
  userId: string,
  provider: ProviderId,
  workId: string,
  raw: RawEntry,
  work: {
    episodes?: number | null;
    chapters?: number | null;
    runtime?: number | null;
    type: string;
  },
): Promise<'created' | 'updated' | 'conflict'> {
  const existing = await Entry.findOne({ userId, workId });
  const now = new Date();

  const source = {
    provider,
    providerEntryId: raw.providerEntryId,
    status: raw.status,
    progress: raw.progress,
    score: raw.score,
    syncedAt: now,
    dirty: false,
  };

  if (!existing) {
    const merged = mergeSources([source]);
    const created = await Entry.create({
      userId,
      workId,
      type: work.type,
      status: merged.status,
      progress: merged.progress,
      progressMax:
        work.episodes ??
        work.chapters ??
        (work.type === 'book' ? work.runtime : null) ??
        (work.type === 'movie' ? 1 : null),
      score: merged.score,
      repeats: raw.repeats ?? 0,
      startedAt: raw.startedAt ? new Date(raw.startedAt) : null,
      completedAt: raw.completedAt ? new Date(raw.completedAt) : null,
      sources: [source],
      hasConflict: merged.hasConflict,
      conflictKinds: merged.conflictKinds,
    });
    if (raw.progress > 0) {
      await ActivityLog.create({
        userId,
        workId,
        type: work.type,
        kind: raw.completedAt ? 'completed' : 'progress',
        delta: raw.progress,
        minutes: estimateMinutes({
          type: work.type as never,
          progress: raw.progress,
          runtime: work.runtime,
          episodeDuration: null,
        }),
        at: raw.completedAt ? new Date(raw.completedAt) : new Date(raw.updatedAt),
        source: provider,
      });
    }
    void created;
    return 'created';
  }

  const prevProgress = existing.sources.find((s) => s.provider === provider)?.progress ?? 0;
  const sources = [
    ...existing.sources.filter((s) => s.provider !== provider).map((s) => s.toObject()),
    source,
  ];

  const merged = mergeSources(
    sources.map((s) => ({
      provider: s.provider,
      status: s.status,
      progress: s.progress,
      score: s.score ?? null,
    })),
  );

  existing.set('sources', sources);
  existing.status = merged.status;
  existing.progress = merged.progress;
  existing.score = merged.score;
  existing.hasConflict = merged.hasConflict;
  existing.conflictKinds = merged.conflictKinds;
  if (!existing.startedAt && raw.startedAt) existing.startedAt = new Date(raw.startedAt);
  if (raw.completedAt) existing.completedAt = new Date(raw.completedAt);
  await existing.save();

  const gained = raw.progress - prevProgress;
  if (gained > 0) {
    await ActivityLog.create({
      userId,
      workId,
      type: work.type,
      kind: raw.completedAt ? 'completed' : 'progress',
      delta: gained,
      minutes: estimateMinutes({
        type: work.type as never,
        progress: gained,
        runtime: work.runtime,
        episodeDuration: null,
      }),
      at: new Date(raw.updatedAt),
      source: provider,
    });
  }

  return merged.hasConflict ? 'conflict' : 'updated';
}
