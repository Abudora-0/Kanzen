import type { ProviderId } from '@kanzen/shared';
import { AniListProvider } from './adapters/anilist.js';
import { TmdbProvider } from './adapters/tmdb.js';
import { StubProvider } from './adapters/stub.js';
import type { MediaProvider } from './types.js';

export type ProviderConfig = {
  anilist?: { clientId?: string; clientSecret?: string };
  tmdb?: { readToken?: string };
};

export type ProviderRegistry = {
  get(id: ProviderId): MediaProvider;
  all(): MediaProvider[];
};

export function createProviderRegistry(config: ProviderConfig = {}): ProviderRegistry {
  const providers: Record<ProviderId, MediaProvider> = {
    anilist: new AniListProvider(config.anilist ?? {}),
    tmdb: new TmdbProvider(config.tmdb ?? {}),
    mal: new StubProvider('mal'),
    kitsu: new StubProvider('kitsu'),
  };

  return {
    get(id) {
      const provider = providers[id];
      if (!provider) throw new Error(`Unknown provider: ${id}`);
      return provider;
    },
    all() {
      return Object.values(providers);
    },
  };
}
