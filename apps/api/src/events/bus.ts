import type { StreamEvent } from '@kanzen/shared';
import { createRedisConnection, getRedis } from '../redis/redis.js';
import { logger } from '../logger.js';

const channel = (userId: string) => `kanzen:events:${userId}`;

/** Fan a stream event out to every SSE listener for one user. */
export async function publishEvent(userId: string, event: StreamEvent): Promise<void> {
  try {
    await getRedis().publish(channel(userId), JSON.stringify(event));
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'event publish skipped');
  }
}

/**
 * Subscribe to a single user's event channel. Returns an unsubscribe function.
 * Uses a dedicated connection because a subscribed client cannot issue commands.
 */
export function subscribeEvents(userId: string, onEvent: (event: StreamEvent) => void): () => void {
  const sub = createRedisConnection();
  const target = channel(userId);

  sub.subscribe(target).catch((err) => logger.warn({ err: err.message }, 'sse subscribe failed'));
  sub.on('message', (chan, payload) => {
    if (chan !== target) return;
    try {
      onEvent(JSON.parse(payload) as StreamEvent);
    } catch {
      /* ignore malformed */
    }
  });

  return () => {
    sub.unsubscribe(target).catch(() => undefined);
    sub.quit().catch(() => undefined);
  };
}
