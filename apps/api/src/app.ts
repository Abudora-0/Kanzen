import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './env.js';
import { logger } from './logger.js';
import { connectMongo } from './db/mongo.js';
import { apiRouter } from './routes/index.js';
import { errorMiddleware, notFound } from './http/errors.js';

let dbReady: Promise<unknown> | null = null;

/**
 * Build the Express app. The same instance backs the local server, the Render
 * service, and the Vercel serverless function.
 */
export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: env.WEB_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  }

  // Connect to Mongo once, lazily, and reuse the promise across invocations.
  app.use((_req, _res, next) => {
    if (!dbReady)
      dbReady = connectMongo().catch((err) => {
        dbReady = null;
        throw err;
      });
    dbReady.then(() => next()).catch(next);
  });

  app.use('/api', apiRouter);

  app.get('/', (_req, res) => {
    res.json({ name: 'Kanzen API', docs: '/api/health' });
  });

  app.use((_req, _res, next) => next(notFound('Route not found')));
  app.use(errorMiddleware);

  return app;
}
