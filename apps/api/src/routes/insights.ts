import { Router } from 'express';
import { toObjectId, InsightSnapshot } from '../models/index.js';
import { requireAuth } from '../auth/middleware.js';
import { asyncHandler } from '../http/errors.js';
import { computeInsights, refreshInsightSnapshot } from '../insights/compute.js';
import { cached, invalidate } from '../cache/cache.js';
import { enqueueInsights } from '../queue/queues.js';

export const insightsRouter: Router = Router();

const FRESH_MS = 1000 * 60 * 15;

insightsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const payload = await cached(`user:${userId}:insights`, { ttl: 300, swr: 900 }, async () => {
      const snapshot = await InsightSnapshot.findOne({ userId: toObjectId(userId) });
      if (snapshot && Date.now() - new Date(snapshot.generatedAt).getTime() < FRESH_MS) {
        return { payload: snapshot.payload, computeMs: snapshot.computeMs, cached: true };
      }
      const fresh = await refreshInsightSnapshot(userId);
      return { payload: fresh, computeMs: 0, cached: false };
    });
    res.json(payload);
  }),
);

insightsRouter.post(
  '/refresh',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    await invalidate(`user:${userId}:insights`);
    if (req.query.async === 'true') {
      await enqueueInsights({ userId, reason: 'manual' }).catch(() => undefined);
      return res.status(202).json({ queued: true });
    }
    const started = Date.now();
    const payload = await computeInsights(userId);
    await refreshInsightSnapshot(userId);
    res.json({ payload, computeMs: Date.now() - started, cached: false });
  }),
);
