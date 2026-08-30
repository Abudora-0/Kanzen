import { Router } from 'express';
import { mongoose } from '../db/mongo.js';
import { getRedis } from '../redis/redis.js';
import { demoMode } from '../env.js';
import { registry } from '../providers/context.js';

export const healthRouter: Router = Router();

healthRouter.get('/', async (_req, res) => {
  const redisOk = await getRedis()
    .ping()
    .then((r) => r === 'PONG')
    .catch(() => false);

  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: redisOk ? 'connected' : 'unavailable',
    demoMode,
    providers: registry.all().map((p) => ({
      id: p.id,
      configured: p.isConfigured(),
    })),
  });
});
