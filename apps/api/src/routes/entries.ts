import { Router } from 'express';
import { entryUpdateSchema, estimateMinutes, resolveConflictSchema } from '@kanzen/shared';
import { ActivityLog, Entry, Work } from '../models/index.js';
import { requireAuth, blockDemoWrites } from '../auth/middleware.js';
import { asyncHandler, notFound } from '../http/errors.js';
import { serializeEntry } from '../dto/serialize.js';
import { mergeSources } from '../sync/merge.js';
import { enqueueInsights, enqueueWriteback } from '../queue/queues.js';
import { invalidate } from '../cache/cache.js';

export const entriesRouter: Router = Router();

entriesRouter.patch(
  '/:id',
  requireAuth,
  blockDemoWrites,
  asyncHandler(async (req, res) => {
    const patch = entryUpdateSchema.parse(req.body);
    const entry = await Entry.findOne({ _id: req.params.id, userId: req.auth!.userId });
    if (!entry) throw notFound('Entry not found');
    const work = await Work.findById(entry.workId);
    if (!work) throw notFound('Work not found');

    const prevProgress = entry.progress ?? 0;
    const prevStatus = entry.status;

    if (patch.status) entry.status = patch.status;
    if (patch.progress != null) entry.progress = patch.progress;
    if (patch.score != null) entry.score = patch.score;
    if (patch.notes != null) entry.notes = patch.notes;

    if (entry.status === 'completed' && !entry.completedAt) entry.completedAt = new Date();
    if (entry.status === 'current' && !entry.startedAt) entry.startedAt = new Date();
    if (
      (patch.progress != null &&
        work.type !== 'movie' &&
        patch.progress >= (entry.progressMax ?? Infinity)) ||
      entry.status === 'completed'
    ) {
      entry.status = 'completed';
      entry.completedAt ??= new Date();
      if (entry.progressMax) entry.progress = entry.progressMax;
    }

    // A local edit marks every provider source dirty so writeback can push it.
    entry.set(
      'sources',
      entry.sources.map((s) => ({
        ...s.toObject(),
        dirty: true,
      })),
    );
    // Recompute conflict flags treating the local values as authoritative.
    const merged = mergeSources([
      {
        provider: 'kanzen',
        status: entry.status,
        progress: entry.progress,
        score: entry.score ?? null,
      },
      ...entry.sources.map((s) => ({
        provider: s.provider,
        status: s.status,
        progress: s.progress,
        score: s.score ?? null,
      })),
    ]);
    entry.hasConflict = merged.hasConflict;
    entry.conflictKinds = merged.conflictKinds;
    await entry.save();

    const gained = (entry.progress ?? 0) - prevProgress;
    if (gained !== 0 || entry.status !== prevStatus) {
      await ActivityLog.create({
        userId: req.auth!.userId,
        workId: entry.workId,
        type: entry.type,
        kind: entry.status === 'completed' ? 'completed' : gained > 0 ? 'progress' : 'status',
        delta: Math.max(gained, 0),
        minutes:
          gained > 0
            ? estimateMinutes({ type: entry.type, progress: gained, runtime: work.runtime })
            : 0,
        at: new Date(),
        source: 'kanzen',
      });
    }

    await Promise.all([
      enqueueWriteback({ userId: String(req.auth!.userId), entryId: String(entry._id) }).catch(
        () => undefined,
      ),
      enqueueInsights({ userId: String(req.auth!.userId), reason: 'edit' }).catch(() => undefined),
      invalidate(`user:${req.auth!.userId}`),
    ]);

    res.json({ entry: serializeEntry(entry, work) });
  }),
);

entriesRouter.post(
  '/:id/resolve',
  requireAuth,
  blockDemoWrites,
  asyncHandler(async (req, res) => {
    const { strategy } = resolveConflictSchema.pick({ strategy: true }).parse(req.body);
    const entry = await Entry.findOne({ _id: req.params.id, userId: req.auth!.userId });
    if (!entry) throw notFound('Entry not found');
    const work = await Work.findById(entry.workId);
    if (!work) throw notFound('Work not found');

    const sources = entry.sources.map((s) => ({
      provider: s.provider,
      status: s.status,
      progress: s.progress,
      score: s.score ?? null,
    }));

    let target = mergeSources(sources);
    if (strategy === 'prefer-remote') {
      const newest = [...entry.sources].sort(
        (a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime(),
      )[0];
      if (newest) {
        target = {
          status: newest.status,
          progress: newest.progress,
          score: newest.score ?? null,
          hasConflict: false,
          conflictKinds: [],
        };
      }
    } else if (strategy === 'prefer-local') {
      target = {
        status: entry.status,
        progress: entry.progress,
        score: entry.score ?? null,
        hasConflict: false,
        conflictKinds: [],
      };
    }

    entry.status = target.status;
    entry.progress = target.progress;
    entry.score = target.score;
    entry.hasConflict = false;
    entry.conflictKinds = [];
    entry.set(
      'sources',
      entry.sources.map((s) => ({ ...s.toObject(), dirty: true })),
    );
    await entry.save();

    await Promise.all([
      enqueueWriteback({ userId: String(req.auth!.userId), entryId: String(entry._id) }).catch(
        () => undefined,
      ),
      enqueueInsights({ userId: String(req.auth!.userId), reason: 'edit' }).catch(() => undefined),
      invalidate(`user:${req.auth!.userId}`),
    ]);

    res.json({ entry: serializeEntry(entry, work) });
  }),
);
