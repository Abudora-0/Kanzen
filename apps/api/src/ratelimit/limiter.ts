import Bottleneck from 'bottleneck';
import CircuitBreaker from 'opossum';
import { PROVIDERS, type ProviderId } from '@kanzen/shared';
import { ProviderRateLimitError, ProviderUnavailableError } from '@kanzen/providers';
import { logger } from '../logger.js';

type ProviderLimiter = {
  limiter: Bottleneck;
  breaker: CircuitBreaker<[() => Promise<unknown>], unknown>;
  penaltyUntil: number;
};

const registry = new Map<ProviderId, ProviderLimiter>();

function build(provider: ProviderId): ProviderLimiter {
  const meta = PROVIDERS[provider];
  /**
   * Reservoir mirrors the published per minute quota and refills every 60s.
   * For a multi instance deployment swap this for `new Bottleneck({ datastore:
   * 'ioredis', clientOptions })` so the quota is shared across workers.
   */
  const limiter = new Bottleneck({
    reservoir: meta.rateLimit.requestsPerMinute,
    reservoirRefreshAmount: meta.rateLimit.requestsPerMinute,
    reservoirRefreshInterval: 60_000,
    maxConcurrent: meta.rateLimit.burst,
    minTime: Math.ceil(60_000 / meta.rateLimit.requestsPerMinute / 2),
  });

  limiter.on('failed', (err, jobInfo) => {
    if (err instanceof ProviderRateLimitError && jobInfo.retryCount < 3) {
      logger.warn(
        { provider, retryAfter: err.retryAfterSeconds },
        'provider rate limited, backing off',
      );
      return err.retryAfterSeconds * 1000;
    }
    if (err instanceof ProviderUnavailableError && jobInfo.retryCount < 2) {
      return 500 * 2 ** jobInfo.retryCount + Math.floor(Math.random() * 250);
    }
    return undefined;
  });

  const breaker = new CircuitBreaker((fn: () => Promise<unknown>) => fn(), {
    timeout: 20_000,
    errorThresholdPercentage: 50,
    resetTimeout: 30_000,
    name: `provider:${provider}`,
  });
  breaker.on('open', () => logger.warn({ provider }, 'circuit breaker opened'));
  breaker.on('halfOpen', () => logger.info({ provider }, 'circuit breaker half open'));
  breaker.on('close', () => logger.info({ provider }, 'circuit breaker closed'));

  return { limiter, breaker, penaltyUntil: 0 };
}

function get(provider: ProviderId): ProviderLimiter {
  let entry = registry.get(provider);
  if (!entry) {
    entry = build(provider);
    registry.set(provider, entry);
  }
  return entry;
}

/**
 * Run a provider call through its rate limiter and circuit breaker. Rate limit
 * errors set a short penalty window that blocks further calls to that provider.
 */
export async function withProviderLimit<T>(provider: ProviderId, fn: () => Promise<T>): Promise<T> {
  const entry = get(provider);
  const wait = entry.penaltyUntil - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 5_000)));

  try {
    return (await entry.limiter.schedule(() =>
      entry.breaker.fire(fn as () => Promise<unknown>),
    )) as T;
  } catch (err) {
    if (err instanceof ProviderRateLimitError) {
      entry.penaltyUntil = Date.now() + err.retryAfterSeconds * 1000;
    }
    throw err;
  }
}

export async function limiterSnapshot(provider: ProviderId) {
  const entry = get(provider);
  const counts = entry.limiter.counts();
  const reservoir = await entry.limiter.currentReservoir().catch(() => null);
  return {
    provider,
    queued: counts.QUEUED + counts.RECEIVED,
    running: counts.RUNNING + counts.EXECUTING,
    reservoir,
    breaker: entry.breaker.opened ? 'open' : entry.breaker.halfOpen ? 'half-open' : 'closed',
    penaltyMs: Math.max(0, entry.penaltyUntil - Date.now()),
  };
}

export function allLimiterSnapshots() {
  return Promise.all(Object.keys(PROVIDERS).map((p) => limiterSnapshot(p as ProviderId)));
}
