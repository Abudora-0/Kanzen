import { Redis, type RedisOptions } from 'ioredis';
import { env, isTest } from '../env.js';
import { logger } from '../logger.js';

/**
 * BullMQ requires `maxRetriesPerRequest: null` and no ready check when running
 * against hosted Redis such as Upstash. We share one base config and hand out
 * dedicated connections where BullMQ needs them.
 */
const baseOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: isTest,
  // Under test there is no Redis; fail fast instead of retrying forever.
  ...(isTest
    ? { retryStrategy: () => null, enableOfflineQueue: false, reconnectOnError: () => false }
    : {}),
};

if (env.REDIS_URL.startsWith('rediss://')) {
  baseOptions.tls = { rejectUnauthorized: false };
}

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, baseOptions);
    client.on('error', (err) => logger.warn({ err: err.message }, 'redis error'));
    client.on('connect', () => logger.info('redis connected'));
  }
  return client;
}

/** A fresh connection, used for BullMQ workers and blocking clients. */
export function createRedisConnection(): Redis {
  const conn = new Redis(env.REDIS_URL, baseOptions);
  conn.on('error', (err) => logger.warn({ err: err.message }, 'redis error'));
  return conn;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
}
