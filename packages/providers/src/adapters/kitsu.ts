import type { MediaType, ProviderId } from '@kanzen/shared';
import { PROVIDERS, fromCanonicalStatus, toCanonicalStatus } from '@kanzen/shared';
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

const OAUTH = 'https://kitsu.io/api/oauth/token';
const API = 'https://kitsu.io/api/edge';
const JSONAPI = {
  accept: 'application/vnd.api+json',
  'content-type': 'application/vnd.api+json',
};

type Attr = Record<string, unknown>;
type Resource = {
  id: string;
  type: string;
  attributes: Attr;
  relationships?: Record<string, { data?: { id: string; type: string } | null }>;
};
type ListResponse = { data: Resource[]; included?: Resource[]; links?: { next?: string } };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

function bestPoster(image: unknown): string | null {
  if (!image || typeof image !== 'object') return null;
  const i = image as Record<string, string>;
  return i.large ?? i.medium ?? i.original ?? i.small ?? null;
}

function mapMedia(res: Resource, mappings: Resource[]): RawWork {
  const a = res.attributes;
  const type: MediaType = res.type === 'manga' ? 'manga' : 'anime';
  const titles = (a.titles as Record<string, string>) ?? {};
  const externalIds: RawWork['externalIds'] = {};
  for (const m of mappings) {
    const site = str(m.attributes.externalSite);
    const id = num(m.attributes.externalId);
    if (!site || id == null) continue;
    if (site.startsWith('myanimelist')) externalIds.mal = id;
    if (site.startsWith('anilist')) externalIds.anilist = id;
  }
  return {
    externalId: res.id,
    externalIds: { kitsu: Number(res.id), ...externalIds },
    type,
    title: {
      romaji: titles.en_jp ?? str(a.canonicalTitle),
      english: titles.en ?? str(a.canonicalTitle),
      native: titles.ja_jp,
    },
    synonyms: Array.isArray(a.abbreviatedTitles) ? (a.abbreviatedTitles as string[]) : [],
    coverImage: bestPoster(a.posterImage),
    bannerImage: bestPoster(a.coverImage),
    format: str(a.subtype)?.toUpperCase() ?? null,
    year: str(a.startDate) ? Number(String(a.startDate).slice(0, 4)) : null,
    genres: [],
    tags: [],
    studios: [],
    episodes: type === 'anime' ? num(a.episodeCount) : null,
    chapters: type === 'manga' ? num(a.chapterCount) : null,
    runtime: null,
    meanScore:
      num(a.averageRating) != null ? Math.round((num(a.averageRating)! / 10) * 10) / 10 : null,
    relations: [],
  };
}

export class KitsuProvider implements MediaProvider {
  id: ProviderId = 'kitsu';
  meta = PROVIDERS.kitsu;

  isConfigured(): boolean {
    // Kitsu needs no app credentials: a user links it with their own login.
    return true;
  }

  getAuthUrl(): string {
    throw new NotConfiguredError('kitsu');
  }

  async exchangeCode(): Promise<{ tokens: TokenSet; handle: string | null }> {
    throw new NotConfiguredError('kitsu');
  }

  async exchangeCredentials(input: {
    username: string;
    password: string;
  }): Promise<{ tokens: TokenSet; handle: string | null }> {
    const { data } = await providerFetch<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>('kitsu', OAUTH, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'password',
        username: input.username,
        password: input.password,
      }).toString(),
    });
    if (!data.access_token) throw new ProviderAuthError('kitsu', 'Kitsu rejected those details');

    const tokens: TokenSet = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    };
    const { data: me } = await providerFetch<ListResponse>(
      'kitsu',
      `${API}/users?filter[self]=true`,
      { headers: { ...JSONAPI, authorization: `Bearer ${tokens.accessToken}` } },
    );
    const self = me.data?.[0];
    tokens.accountId = self?.id;
    return { tokens, handle: str(self?.attributes.name) ?? null };
  }

  async refresh(tokens: TokenSet): Promise<TokenSet> {
    if (!tokens.refreshToken) throw new ProviderAuthError('kitsu', 'No refresh token available');
    const { data } = await providerFetch<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>('kitsu', OAUTH, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
      }).toString(),
    });
    return {
      ...tokens,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    };
  }

  async fetchLibrary(ctx: SyncContext): Promise<Page<RawEntry>> {
    if (ctx.demo) return { items: demoLibrary('kitsu', ctx.userId), nextCursor: null };
    const userId = ctx.tokens.accountId;
    if (!userId) throw new ProviderAuthError('kitsu', 'Missing Kitsu account id');
    const auth = { ...JSONAPI, authorization: `Bearer ${ctx.tokens.accessToken}` };

    const items: RawEntry[] = [];
    let url: string | undefined =
      `${API}/library-entries?filter[userId]=${userId}&filter[kind]=anime,manga` +
      `&include=media,media.mappings&page[limit]=250` +
      `&fields[libraryEntries]=status,progress,ratingTwenty,reconsuming,reconsumeCount,startedAt,finishedAt,updatedAt,media`;
    let guard = 0;

    while (url && guard < 40) {
      const { data }: { data: ListResponse } = await providerFetch<ListResponse>('kitsu', url, {
        headers: auth,
      });
      const byKey = new Map((data.included ?? []).map((r) => [`${r.type}:${r.id}`, r]));

      for (const entry of data.data ?? []) {
        const a = entry.attributes;
        const mediaRef = entry.relationships?.media?.data;
        if (!mediaRef) continue;
        const media = byKey.get(`${mediaRef.type}:${mediaRef.id}`);
        if (!media) continue;
        const mappings = Object.values(entry.relationships ?? {})
          .flatMap((r) => (r.data ? [r.data] : []))
          .filter((d) => d.type === 'mappings')
          .map((d) => byKey.get(`mappings:${d.id}`))
          .filter((r): r is Resource => Boolean(r));

        const updatedAt = str(a.updatedAt) ?? new Date().toISOString();
        if (ctx.since && new Date(updatedAt) < ctx.since) continue;

        const ratingTwenty = num(a.ratingTwenty);
        items.push({
          providerEntryId: entry.id,
          work: mapMedia(media, mappings),
          status: a.reconsuming ? 'repeating' : toCanonicalStatus('kitsu', String(a.status ?? '')),
          progress: num(a.progress) ?? 0,
          score: ratingTwenty ? Math.round((ratingTwenty / 2) * 2) / 2 : null,
          repeats: num(a.reconsumeCount) ?? 0,
          startedAt: str(a.startedAt) ?? null,
          completedAt: str(a.finishedAt) ?? null,
          updatedAt,
        });
      }
      url = data.links?.next;
      guard += 1;
    }
    return { items, nextCursor: null };
  }

  async updateEntry(ctx: SyncContext, input: WritebackInput): Promise<void> {
    if (ctx.demo) return;
    const status = fromCanonicalStatus('kitsu', input.status);
    const attributes: Attr = { progress: input.progress };
    if (status) attributes.status = status;
    if (input.score != null) attributes.ratingTwenty = Math.round(input.score * 2);
    await providerFetch('kitsu', `${API}/library-entries/${input.providerEntryId}`, {
      method: 'PATCH',
      headers: { ...JSONAPI, authorization: `Bearer ${ctx.tokens.accessToken}` },
      body: JSON.stringify({
        data: { id: input.providerEntryId, type: 'libraryEntries', attributes },
      }),
    });
  }
}
