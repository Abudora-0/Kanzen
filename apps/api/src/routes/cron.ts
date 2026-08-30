import { Router, type Request } from 'express';
import { env } from '../env.js';
import { Connection, SyncRun } from '../models/index.js';
import { asyncHandler, forbidden } from '../http/errors.js';
import { enqueueSync } from '../queue/queues.js';
import { runSync } from '../sync/engine.js';
import { refreshInsightSnapshot } from '../insights/compute.js';
import { logger } from '../logger.js';

export const cronRouter: Router = Router();

function authorize(req: Request): void {
  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : String(req.query.key ?? '');
  if (bearer !== env.CRON_SECRET) throw forbidden('Bad cron secret');
}

/**
 * Vercel Cron entry point. Picks connections that have not synced recently and
 * enqueues an incremental sync. When no queue worker is reachable it falls back
 * to running the sync inline so the deployed demo still refreshes.
 */
cronRouter.post(
  '/sync',
  asyncHandler(async (req, res) => {
    authorize(req);
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 6);
    const due = await Connection.find({
      status: 'active',
      $or: [{ lastSyncedAt: null }, { lastSyncedAt: { $lt: cutoff } }],
    }).limit(25);

    let queued = 0;
    let inline = 0;
    for (const conn of due) {
      const run = await SyncRun.create({
        userId: conn.userId,
        connectionId: conn._id,
        provider: conn.provider,
        mode: 'incremental',
        state: 'queued',
      });
      try {
        await enqueueSync({
          userId: String(conn.userId),
          connectionId: String(conn._id),
          provider: conn.provider,
          mode: 'incremental',
          syncRunId: String(run._id),
        });
        queued += 1;
      } catch (err) {
        logger.warn({ err: (err as Error).message }, 'cron falling back to inline sync');
        await runSync({ connection: conn, mode: 'incremental', syncRunId: String(run._id) }).catch(
          (e) => logger.error({ err: e.message }, 'inline sync failed'),
        );
        await refreshInsightSnapshot(String(conn.userId)).catch(() => undefined);
        inline += 1;
      }
    }

    res.json({ considered: due.length, queued, inline });
  }),
);
