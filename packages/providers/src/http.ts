import type { ProviderId } from '@kanzen/shared';
import { ProviderAuthError, ProviderRateLimitError, ProviderUnavailableError } from './errors.js';

export type FetchResult<T> = { data: T; headers: Headers; status: number };

/**
 * A thin fetch wrapper that turns provider HTTP failures into typed errors.
 * Rate limit responses carry the Retry-After value so the queue can back off.
 */
export async function providerFetch<T>(
  provider: ProviderId,
  url: string,
  init: RequestInit = {},
): Promise<FetchResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ProviderUnavailableError(provider, 0);
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after')) || 60;
    throw new ProviderRateLimitError(provider, retryAfter);
  }
  if (res.status === 401 || res.status === 403) {
    throw new ProviderAuthError(provider);
  }
  if (res.status >= 500) {
    throw new ProviderUnavailableError(provider, res.status);
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (res.status >= 400) {
    throw new ProviderUnavailableError(provider, res.status);
  }

  return { data, headers: res.headers, status: res.status };
}

/** Normalise a 0..100 or 0..5 provider score onto Kanzen's 0..10 scale. */
export function normaliseScore(raw: number | null | undefined, scale: 10 | 100 | 5): number | null {
  if (raw == null || raw === 0) return null;
  if (scale === 10) return Math.round(raw * 2) / 2;
  if (scale === 100) return Math.round((raw / 10) * 2) / 2;
  return Math.round(raw * 2 * 2) / 2;
}
