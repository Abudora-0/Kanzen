import type { ProviderId } from '@kanzen/shared';
import { PROVIDERS } from '@kanzen/shared';
import { NotConfiguredError } from '../errors.js';
import { demoLibrary } from '../fixtures/index.js';
import type { MediaProvider, Page, RawEntry, SyncContext, TokenSet } from '../types.js';

/**
 * MyAnimeList and Kitsu share the MediaProvider surface but are not wired to
 * their real APIs yet. In demo mode they return deterministic fixture data so
 * the sync engine, conflict detection, and insights all have multi-provider
 * input to work with. Outside demo mode every method reports that the provider
 * needs credentials and adapter work.
 */
export class StubProvider implements MediaProvider {
  meta;

  constructor(public id: ProviderId) {
    this.meta = PROVIDERS[id];
  }

  isConfigured(): boolean {
    return false;
  }

  getAuthUrl(): string {
    throw new NotConfiguredError(this.id);
  }

  async exchangeCode(): Promise<{ tokens: TokenSet; handle: string | null }> {
    throw new NotConfiguredError(this.id);
  }

  async refresh(): Promise<TokenSet> {
    throw new NotConfiguredError(this.id);
  }

  async fetchLibrary(ctx: SyncContext): Promise<Page<RawEntry>> {
    if (ctx.demo) return { items: demoLibrary(this.id, ctx.userId), nextCursor: null };
    throw new NotConfiguredError(this.id);
  }

  async updateEntry(ctx: SyncContext): Promise<void> {
    if (ctx.demo) return;
    throw new NotConfiguredError(this.id);
  }
}
