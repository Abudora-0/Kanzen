import type { ProviderId } from '@kanzen/shared';

export class ProviderError extends Error {
  constructor(
    public provider: ProviderId,
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class NotConfiguredError extends ProviderError {
  constructor(provider: ProviderId) {
    super(
      provider,
      `${provider} is not configured. Set its client credentials or enable PROVIDERS_DEMO_MODE.`,
      'not_configured',
    );
    this.name = 'NotConfiguredError';
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(provider: ProviderId, message = 'Authorization failed or token expired') {
    super(provider, message, 'auth');
    this.name = 'ProviderAuthError';
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(
    provider: ProviderId,
    /** Seconds to wait before retrying, taken from Retry-After when present. */
    public retryAfterSeconds: number,
  ) {
    super(provider, `${provider} rate limit hit, retry in ${retryAfterSeconds}s`, 'rate_limited');
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(provider: ProviderId, status: number) {
    super(provider, `${provider} responded with ${status}`, 'unavailable');
    this.name = 'ProviderUnavailableError';
  }
}
