import { Router, type Request } from 'express';
import { env } from '../env.js';
import { Connection } from '../models/index.js';
import { asyncHandler, forbidden } from '../http/errors.js';
import { dispatchSync } from '../sync/dispatch.js';
import { seedDatabase } from '../seed/seedDatabase.js';

export const cronRouter: Router = Router();

function authorize(req: Request): void {
  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : String(req.query.key ?? '');
  if (bearer !== env.CRON_SECRET) throw forbidden('Bad cron secret');
}

/**
 * Vercel Cron entry point. Picks connections that have not synced recently and
 * dispatches an incremental sync for each (queued when a worker is running,
 * inline otherwise).
 */
cronRouter.post(
  '/sync',
  asyncHandler(async (req, res) => {
    authorize(req);
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 6);
    const due = await Connection.find({
      status: 'active',
      $or: [{ lastSyncedAt: null }, { lastSyncedAt: { $lt: cutoff } }],
    }).limit(15);

    for (const conn of due) {
      await dispatchSync({ connection: conn, mode: 'incremental' });
    }
    res.json({ considered: due.length });
  }),
);

/**
 * Populate a fresh deployment with the demo library. Guarded by CRON_SECRET so
 * it can be triggered once after the first deploy:
 *   curl -X POST "https://<domain>/api/cron/seed?key=<CRON_SECRET>"
 * Destructive: it resets the demo data. Not exposed in the UI.
 */
cronRouter.post(
  '/seed',
  asyncHandler(async (req, res) => {
    authorize(req);
    const result = await seedDatabase();
    res.json({ ok: true, ...result });
  }),
);
