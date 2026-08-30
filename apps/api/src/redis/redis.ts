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
  ...(isTest
    ? { retryStrategy: () => null, enableOfflineQueue: false, reconnectOnError: () => false }
    : { retryStrategy: (times: number) => Math.min(times * 400, 8000) }),
};

if (env.REDIS_URL.startsWith('rediss://')) {
  baseOptions.tls = { rejectUnauthorized: false };
}

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    // The shared client is used for cache and pub/sub only. A short command
    // timeout means a missing Redis degrades gracefully rather than hanging a
    // request. BullMQ connections below must not carry this.
    client = new Redis(env.REDIS_URL, { ...baseOptions, commandTimeout: 2000 });
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
