import type { MediaType } from './media.js';

export const PROVIDER_IDS = ['anilist', 'mal', 'kitsu', 'tmdb'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ProviderMeta = {
  id: ProviderId;
  name: string;
  /** Which media domains this provider can supply. */
  media: MediaType[];
  /** OAuth 2.0 flow used by the adapter. */
  auth: 'oauth2-pkce' | 'oauth2' | 'api-key' | 'none';
  /** Published rate limit, used to seed the client side limiter. */
  rateLimit: { requestsPerMinute: number; burst: number };
  color: string;
  /** Real integration versus fixture-backed stub. */
  status: 'live' | 'stub';
  docs: string;
};

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  anilist: {
    id: 'anilist',
    name: 'AniList',
    media: ['anime', 'manga'],
    auth: 'oauth2-pkce',
    rateLimit: { requestsPerMinute: 90, burst: 10 },
    color: '#4bb3f7',
    status: 'live',
    docs: 'https://anilist.gitbook.io/anilist-apiv2-docs',
  },
  mal: {
    id: 'mal',
    name: 'MyAnimeList',
    media: ['anime', 'manga'],
    auth: 'oauth2-pkce',
    rateLimit: { requestsPerMinute: 60, burst: 6 },
    color: '#2e51a2',
    status: 'live',
    docs: 'https://myanimelist.net/apiconfig/references/api/v2',
  },
  kitsu: {
    id: 'kitsu',
    name: 'Kitsu',
    media: ['anime', 'manga'],
    auth: 'oauth2',
    rateLimit: { requestsPerMinute: 60, burst: 6 },
    color: '#f2542d',
    status: 'stub',
    docs: 'https://kitsu.docs.apiary.io',
  },
  tmdb: {
    id: 'tmdb',
    name: 'TMDB',
    media: ['movie'],
    auth: 'api-key',
    rateLimit: { requestsPerMinute: 250, burst: 40 },
    color: '#01b4e4',
    status: 'live',
    docs: 'https://developer.themoviedb.org/reference/intro/getting-started',
  },
};

export type ConnectionStatus = 'active' | 'expired' | 'error' | 'revoked';
