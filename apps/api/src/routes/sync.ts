import { Router } from 'express';
import { syncRequestSchema } from '@kanzen/shared';
import { SyncRun, toObjectId } from '../models/index.js';
import { Connection } from '../models/index.js';
import { requireAuth, blockDemoWrites } from '../auth/middleware.js';
import { asyncHandler, badRequest, notFound } from '../http/errors.js';
import { serializeSyncRun } from '../dto/serialize.js';
import { getQueues } from '../queue/queues.js';
import { allLimiterSnapshots } from '../ratelimit/limiter.js';
import { dispatchSync, reapStaleSyncRuns } from '../sync/dispatch.js';

export const syncRouter: Router = Router();

syncRouter.post(
  '/',
  requireAuth,
  blockDemoWrites,
  asyncHandler(async (req, res) => {
    const body = syncRequestSchema.parse(req.body);
    const filter: Record<string, unknown> = { userId: req.auth!.userId };
    if (body.provider) filter.provider = body.provider;
    const connections = await Connection.find(filter);
    if (connections.length === 0) throw badRequest('Connect a platform before syncing');

    const runs = [];
    for (const conn of connections) {
      const run = await dispatchSync({ connection: conn, mode: body.mode });
      const fresh = (await SyncRun.findById(run._id)) ?? run;
      runs.push(serializeSyncRun(fresh));
    }
    res.status(202).json({ runs });
  }),
);

// Cancellation is cooperative: this just flags the run and (for the worker
// path only) tries to drop an unstarted BullMQ job outright. The loop in
// engine.ts polls the flag every ten entries and stops itself when it sees it,
// whether it is running inline in this same request or in a worker process.
syncRouter.post(
  '/:id/cancel',
  requireAuth,
  blockDemoWrites,
  asyncHandler(async (req, res) => {
    const run = await SyncRun.findOne({ _id: req.params.id, userId: req.auth!.userId });
    if (!run) throw notFound('Sync run not found');

    if (run.state === 'queued' || run.state === 'running') {
      run.cancelRequested = true;
      if (run.state === 'queued' && run.jobId) {
        try {
          const job = await getQueues().sync.getJob(run.jobId);
          if (job && !(await job.isActive())) {
            await job.remove();
            run.state = 'cancelled';
            run.finishedAt = new Date();
          }
        } catch {
          /* Redis unreachable; the flag still stops it once the worker starts. */
        }
      }
      await run.save();
    }
    res.json({ run: serializeSyncRun(run) });
  }),
);

syncRouter.get(
  '/runs',
  requireAuth,
  asyncHandler(async (req, res) => {
    await reapStaleSyncRuns({ userId: toObjectId(req.auth!.userId) });
    const runs = await SyncRun.find({ userId: toObjectId(req.auth!.userId) })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ runs: runs.map(serializeSyncRun) });
  }),
);

// Only terminal-state runs are removable, so an in-flight sync can never be
// lost by clearing history out from under it.
syncRouter.delete(
  '/runs',
  requireAuth,
  blockDemoWrites,
  asyncHandler(async (req, res) => {
    const result = await SyncRun.deleteMany({
      userId: toObjectId(req.auth!.userId),
      state: { $in: ['done', 'failed', 'cancelled'] },
    });
    res.json({ deleted: result.deletedCount ?? 0 });
  }),
);

syncRouter.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    await reapStaleSyncRuns({ userId: toObjectId(req.auth!.userId) });
    const [limiters, queueCounts, activeRuns] = await Promise.all([
      allLimiterSnapshots(),
      getQueues()
        .sync.getJobCounts('waiting', 'active', 'delayed', 'failed')
        .catch(() => ({ waiting: 0, active: 0, delayed: 0, failed: 0 })),
      SyncRun.find({
        userId: toObjectId(req.auth!.userId),
        state: { $in: ['queued', 'running'] },
      }).sort({ createdAt: -1 }),
    ]);
    res.json({
      limiters,
      queue: queueCounts,
      activeRuns: activeRuns.map(serializeSyncRun),
    });
  }),
);
