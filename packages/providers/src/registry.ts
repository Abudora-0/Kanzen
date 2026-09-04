import type { ProviderId } from '@kanzen/shared';
import { AniListProvider } from './adapters/anilist.js';
import { MalProvider } from './adapters/mal.js';
import { KitsuProvider } from './adapters/kitsu.js';
import { TmdbProvider } from './adapters/tmdb.js';
import type { MediaProvider } from './types.js';

export type ProviderConfig = {
  anilist?: { clientId?: string; clientSecret?: string };
  mal?: { clientId?: string; clientSecret?: string };
  tmdb?: { readToken?: string };
};

export type ProviderRegistry = {
  get(id: ProviderId): MediaProvider;
  all(): MediaProvider[];
};

export function createProviderRegistry(config: ProviderConfig = {}): ProviderRegistry {
  const providers: Record<ProviderId, MediaProvider> = {
    anilist: new AniListProvider(config.anilist ?? {}),
    mal: new MalProvider(config.mal ?? {}),
    kitsu: new KitsuProvider(),
    tmdb: new TmdbProvider(config.tmdb ?? {}),
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
