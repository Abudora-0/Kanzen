import { LRUCache } from 'lru-cache';
import { getRedis } from '../redis/redis.js';
import { logger } from '../logger.js';

type Entry<T> = { value: T; storedAt: number; staleAt: number; expiresAt: number };

const local = new LRUCache<string, Entry<unknown>>({ max: 1000, ttl: 1000 * 60 * 10 });

export type CacheOptions = {
  /** Seconds the value is considered fresh. */
  ttl: number;
  /** Extra seconds the value may still be served while it revalidates. */
  swr?: number;
  /** Skip the cache and force a recompute. */
  bypass?: boolean;
};

const inflight = new Map<string, Promise<unknown>>();

/**
 * Cache aside with stale while revalidate across an in process LRU and Redis.
 * A single loader runs at a time per key even under concurrent callers.
 */
export async function cached<T>(
  key: string,
  opts: CacheOptions,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const namespaced = `kanzen:cache:${key}`;

  if (!opts.bypass) {
    const localHit = local.get(namespaced) as Entry<T> | undefined;
    const hit = localHit ?? (await readRedis<T>(namespaced));
    if (hit) {
      if (now < hit.staleAt) return hit.value;
      if (now < hit.expiresAt) {
        void revalidate(namespaced, opts, loader);
        return hit.value;
      }
    }
  }

  return revalidate(namespaced, opts, loader);
}

async function revalidate<T>(
  key: string,
  opts: CacheOptions,
  loader: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const run = (async () => {
    const value = await loader();
    const now = Date.now();
    const entry: Entry<T> = {
      value,
      storedAt: now,
      staleAt: now + opts.ttl * 1000,
      expiresAt: now + (opts.ttl + (opts.swr ?? 0)) * 1000,
    };
    local.set(key, entry);
    await writeRedis(key, entry, opts.ttl + (opts.swr ?? 0));
    return value;
  })().finally(() => inflight.delete(key));

  inflight.set(key, run);
  return run;
}

async function readRedis<T>(key: string): Promise<Entry<T> | null> {
  try {
    const raw = await getRedis().get(key);
    return raw ? (JSON.parse(raw) as Entry<T>) : null;
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'cache read miss (redis)');
    return null;
  }
}

async function writeRedis<T>(key: string, entry: Entry<T>, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().set(key, JSON.stringify(entry), 'EX', Math.ceil(ttlSeconds));
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'cache write skipped (redis)');
  }
}

export async function invalidate(prefix: string): Promise<void> {
  for (const key of local.keys()) {
    if (key.includes(prefix)) local.delete(key);
  }
  try {
    const redis = getRedis();
    const pattern = `kanzen:cache:*${prefix}*`;
    const stream = redis.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream) {
      if ((keys as string[]).length) await redis.del(...(keys as string[]));
    }
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'cache invalidate skipped');
  }
}
