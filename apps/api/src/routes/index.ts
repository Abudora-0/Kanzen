import { Router } from 'express';
import { authRouter } from './auth.js';
import { connectionsRouter } from './connections.js';
import { libraryRouter } from './library.js';
import { entriesRouter } from './entries.js';
import { worksRouter } from './works.js';
import { syncRouter } from './sync.js';
import { insightsRouter } from './insights.js';
import { streamRouter } from './stream.js';
import { cronRouter } from './cron.js';
import { healthRouter } from './health.js';
import { settingsRouter } from './settings.js';

export const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/connections', connectionsRouter);
apiRouter.use('/library', libraryRouter);
apiRouter.use('/entries', entriesRouter);
apiRouter.use('/works', worksRouter);
apiRouter.use('/sync', syncRouter);
apiRouter.use('/insights', insightsRouter);
apiRouter.use('/stream', streamRouter);
apiRouter.use('/cron', cronRouter);
apiRouter.use('/settings', settingsRouter);
