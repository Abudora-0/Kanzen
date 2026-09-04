import type { ProviderId } from '@kanzen/shared';
import { PROVIDERS } from '@kanzen/shared';
import { NotConfiguredError, ProviderAuthError } from '../errors.js';
import { providerFetch } from '../http.js';
import { demoLibrary } from '../fixtures/index.js';
import type {
  MediaProvider,
  Page,
  RawEntry,
  RawWork,
  SyncContext,
  TokenSet,
  WritebackInput,
} from '../types.js';

const API = 'https://api.themoviedb.org';
const IMG = 'https://image.tmdb.org/t/p';

const GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

type TmdbMovie = {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  runtime: number | null;
  vote_average: number | null;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
};

function mapMovie(m: TmdbMovie): RawWork {
  const genreNames = m.genres
    ? m.genres.map((g) => g.name)
    : (m.genre_ids ?? []).map((id) => GENRES[id]).filter((x): x is string => Boolean(x));
  const year = m.release_date ? Number(m.release_date.slice(0, 4)) : null;
  return {
    externalId: String(m.id),
    externalIds: { tmdb: m.id },
    type: 'movie',
    title: {
      english: m.title,
      native: m.original_language !== 'en' ? m.original_title : undefined,
    },
    coverImage: m.poster_path ? `${IMG}/w500${m.poster_path}` : null,
    bannerImage: m.backdrop_path ? `${IMG}/w1280${m.backdrop_path}` : null,
    format: 'Movie',
    year: Number.isFinite(year) ? year : null,
    genres: genreNames,
    tags: [],
    studios: [],
    episodes: null,
    chapters: null,
    runtime: m.runtime ?? null,
    meanScore: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null,
    relations: [],
  };
}

export class TmdbProvider implements MediaProvider {
  id: ProviderId = 'tmdb';
  meta = PROVIDERS.tmdb;

  constructor(private config: { readToken?: string } = {}) {}

  isConfigured(): boolean {
    return Boolean(this.config.readToken);
  }

  private headers(userToken?: string): Record<string, string> {
    return {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${userToken ?? this.config.readToken}`,
    };
  }

  async getAuthUrl(input: { state: string; redirectUri: string }): Promise<string> {
    if (!this.isConfigured()) throw new NotConfiguredError('tmdb');
    // TMDB does not echo an OAuth state, so carry it on the redirect URL itself.
    const redirectTo = `${input.redirectUri}?state=${encodeURIComponent(input.state)}`;
    const { data } = await providerFetch<{ request_token: string; success: boolean }>(
      'tmdb',
      `${API}/4/auth/request_token`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ redirect_to: redirectTo }),
      },
    );
    if (!data.request_token) throw new ProviderAuthError('tmdb', 'Could not create request token');
    return `https://www.themoviedb.org/auth/access?request_token=${data.request_token}`;
  }

  async exchangeCode(input: {
    code: string;
  }): Promise<{ tokens: TokenSet; handle: string | null }> {
    if (!this.isConfigured()) throw new NotConfiguredError('tmdb');
    const { data } = await providerFetch<{
      access_token: string;
      account_id: string;
      success: boolean;
    }>('tmdb', `${API}/4/auth/access_token`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ request_token: input.code }),
    });
    return {
      tokens: { accessToken: data.access_token, accountId: data.account_id },
      handle: null,
    };
  }

  async refresh(tokens: TokenSet): Promise<TokenSet> {
    // TMDB v4 access tokens do not expire.
    return tokens;
  }

  async fetchLibrary(ctx: SyncContext): Promise<Page<RawEntry>> {
    if (ctx.demo) return { items: demoLibrary('tmdb', ctx.userId), nextCursor: null };
    if (!this.isConfigured()) throw new NotConfiguredError('tmdb');
    const accountId = ctx.tokens.accountId;
    if (!accountId) throw new ProviderAuthError('tmdb', 'Missing account id');

    const items: RawEntry[] = [];
    const collect = async (path: string, status: RawEntry['status']) => {
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages && page <= 20) {
        const { data } = await providerFetch<{
          results: TmdbMovie[];
          total_pages: number;
        }>('tmdb', `${API}/4/account/${accountId}/${path}?page=${page}`, {
          headers: this.headers(ctx.tokens.accessToken),
        });
        totalPages = data.total_pages ?? 1;
        for (const movie of data.results ?? []) {
          items.push({
            providerEntryId: `tmdb-${path}-${movie.id}`,
            work: mapMovie(movie),
            status,
            progress: status === 'completed' ? 1 : 0,
            score: null,
            updatedAt: new Date().toISOString(),
          });
        }
        page += 1;
      }
    };

    await collect('movie/watchlist', 'planning');
    await collect('movie/favorites', 'completed');
    return { items, nextCursor: null };
  }

  async updateEntry(ctx: SyncContext, input: WritebackInput): Promise<void> {
    if (ctx.demo) return;
    if (!this.isConfigured()) throw new NotConfiguredError('tmdb');
    const accountId = ctx.tokens.accountId;
    if (!accountId) throw new ProviderAuthError('tmdb', 'Missing account id');
    const wantWatchlist = input.status === 'planning' || input.status === 'current';
    await providerFetch('tmdb', `${API}/3/account/${accountId}/watchlist`, {
      method: 'POST',
      headers: this.headers(ctx.tokens.accessToken),
      body: JSON.stringify({
        media_type: 'movie',
        media_id: Number(input.externalWorkId),
        watchlist: wantWatchlist,
      }),
    });
  }
}
