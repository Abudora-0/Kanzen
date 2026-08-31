import { Router } from 'express';
import { syncRequestSchema } from '@kanzen/shared';
import { SyncRun, toObjectId } from '../models/index.js';
import { Connection } from '../models/index.js';
import { requireAuth, blockDemoWrites } from '../auth/middleware.js';
import { asyncHandler, badRequest } from '../http/errors.js';
import { serializeSyncRun } from '../dto/serialize.js';
import { getQueues } from '../queue/queues.js';
import { allLimiterSnapshots } from '../ratelimit/limiter.js';
import { dispatchSync } from '../sync/dispatch.js';

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

syncRouter.get(
  '/runs',
  requireAuth,
  asyncHandler(async (req, res) => {
    const runs = await SyncRun.find({ userId: toObjectId(req.auth!.userId) })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ runs: runs.map(serializeSyncRun) });
  }),
);

syncRouter.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
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
