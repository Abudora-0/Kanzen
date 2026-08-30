import { Router } from 'express';
import type { StreamEvent } from '@kanzen/shared';
import { requireAuth } from '../auth/middleware.js';
import { subscribeEvents } from '../events/bus.js';
import { allLimiterSnapshots } from '../ratelimit/limiter.js';

export const streamRouter: Router = Router();

/**
 * Server sent events for one user. Carries sync progress, sync state, and a
 * periodic rate limiter snapshot that drives the Sync Pulse panel.
 */
streamRouter.get('/', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event: StreamEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  send({ type: 'hello', now: new Date().toISOString() });

  const unsubscribe = subscribeEvents(req.auth!.userId, send);

  const limiterTimer = setInterval(async () => {
    const snapshots = await allLimiterSnapshots();
    for (const snap of snapshots) {
      if (snap.queued > 0 || snap.running > 0 || snap.penaltyMs > 0) {
        send({
          type: 'limiter',
          provider: snap.provider,
          remaining: snap.reservoir ?? 0,
          reservoir: snap.reservoir ?? 0,
          queued: snap.queued,
        });
      }
    }
  }, 3000);

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 20000);

  req.on('close', () => {
    clearInterval(limiterTimer);
    clearInterval(keepAlive);
    unsubscribe();
    res.end();
  });
});
