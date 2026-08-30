import type { MediaType, ProviderId, WorkRelation } from '@kanzen/shared';
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

const AUTHORIZE_URL = 'https://anilist.co/api/v2/oauth/authorize';
const TOKEN_URL = 'https://anilist.co/api/v2/oauth/token';
const GRAPHQL_URL = 'https://graphql.anilist.co';

type FuzzyDate = { year: number | null; month: number | null; day: number | null };

type AniListMedia = {
  id: number;
  idMal: number | null;
  type: 'ANIME' | 'MANGA';
  format: string | null;
  episodes: number | null;
  chapters: number | null;
  duration: number | null;
  averageScore: number | null;
  genres: string[];
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  coverImage: { large: string | null } | null;
  bannerImage: string | null;
  seasonYear: number | null;
  startDate: FuzzyDate | null;
  studios: { nodes: { name: string; isAnimationStudio: boolean }[] } | null;
  tags: { name: string; rank: number }[];
  relations: { edges: { relationType: string; node: { id: number } }[] } | null;
};

type AniListEntry = {
  id: number;
  status: string;
  score: number | null;
  progress: number | null;
  repeat: number | null;
  updatedAt: number | null;
  startedAt: FuzzyDate | null;
  completedAt: FuzzyDate | null;
  media: AniListMedia;
};

const RELATION_MAP: Record<string, WorkRelation['relationType']> = {
  SEQUEL: 'sequel',
  PREQUEL: 'prequel',
  SIDE_STORY: 'side_story',
  PARENT: 'parent',
  ADAPTATION: 'adaptation',
  ALTERNATIVE: 'alternative',
  SPIN_OFF: 'spin_off',
};

function fuzzyToIso(d: FuzzyDate | null): string | null {
  if (!d || !d.year) return null;
  const month = String(d.month ?? 1).padStart(2, '0');
  const day = String(d.day ?? 1).padStart(2, '0');
  return `${d.year}-${month}-${day}T00:00:00.000Z`;
}

function mapMedia(media: AniListMedia): RawWork {
  const type: MediaType = media.type === 'MANGA' ? 'manga' : 'anime';
  return {
    externalId: String(media.id),
    externalIds: { anilist: media.id, mal: media.idMal ?? undefined },
    type,
    title: {
      romaji: media.title.romaji ?? undefined,
      english: media.title.english ?? undefined,
      native: media.title.native ?? undefined,
    },
    synonyms: media.synonyms ?? [],
    coverImage: media.coverImage?.large ?? null,
    bannerImage: media.bannerImage ?? null,
    format: media.format,
    year: media.seasonYear ?? media.startDate?.year ?? null,
    genres: media.genres ?? [],
    tags: (media.tags ?? [])
      .filter((t) => t.rank >= 40)
      .slice(0, 8)
      .map((t) => t.name),
    studios: (media.studios?.nodes ?? []).filter((s) => s.isAnimationStudio).map((s) => s.name),
    episodes: type === 'anime' ? media.episodes : null,
    chapters: type === 'manga' ? media.chapters : null,
    runtime: null,
    meanScore: media.averageScore != null ? Math.round((media.averageScore / 10) * 10) / 10 : null,
    relations: (media.relations?.edges ?? [])
      .map((edge) => {
        const relationType = RELATION_MAP[edge.relationType];
        if (!relationType) return null;
        return { relationType, externalId: String(edge.node.id) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

const LIST_QUERY = /* GraphQL */ `
  query ($userId: Int, $type: MediaType, $chunk: Int, $perChunk: Int) {
    MediaListCollection(userId: $userId, type: $type, chunk: $chunk, perChunk: $perChunk) {
      hasNextChunk
      lists {
        entries {
          id
          status
          score(format: POINT_10_DECIMAL)
          progress
          repeat
          updatedAt
          startedAt {
            year
            month
            day
          }
          completedAt {
            year
            month
            day
          }
          media {
            id
            idMal
            type
            format
            episodes
            chapters
            duration
            averageScore
            genres
            seasonYear
            startDate {
              year
              month
              day
            }
            title {
              romaji
              english
              native
            }
            synonyms
            coverImage {
              large
            }
            bannerImage
            studios {
              nodes {
                name
                isAnimationStudio
              }
            }
            tags {
              name
              rank
            }
            relations {
              edges {
                relationType
                node {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;

const VIEWER_QUERY = /* GraphQL */ `
  query {
    Viewer {
      id
      name
    }
  }
`;

const SAVE_MUTATION = /* GraphQL */ `
  mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $score: Float) {
    SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, score: $score) {
      id
    }
  }
`;

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const { data } = await providerFetch<{ data: T; errors?: { message: string }[] }>(
    'anilist',
    GRAPHQL_URL,
    { method: 'POST', headers, body: JSON.stringify({ query, variables }) },
  );
  if (data.errors?.length) {
    const message = data.errors.map((e) => e.message).join('; ');
    if (/invalid.*token|unauthor/i.test(message)) throw new ProviderAuthError('anilist', message);
    throw new Error(`AniList GraphQL error: ${message}`);
  }
  return data.data;
}

export class AniListProvider implements MediaProvider {
  id: ProviderId = 'anilist';
  meta = PROVIDERS.anilist;

  constructor(private config: { clientId?: string; clientSecret?: string } = {}) {}

  isConfigured(): boolean {
    return Boolean(this.config.clientId && this.config.clientSecret);
  }

  getAuthUrl(input: { state: string; redirectUri: string }): string {
    if (!this.config.clientId) throw new NotConfiguredError('anilist');
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: input.redirectUri,
      response_type: 'code',
      state: input.state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: TokenSet; handle: string | null }> {
    if (!this.isConfigured()) throw new NotConfiguredError('anilist');
    const { data } = await providerFetch<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
    }>('anilist', TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: input.redirectUri,
        code: input.code,
      }),
    });
    const tokens: TokenSet = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      tokenType: data.token_type,
    };
    let handle: string | null = null;
    try {
      const viewer = await gql<{ Viewer: { id: number; name: string } }>(
        VIEWER_QUERY,
        {},
        tokens.accessToken,
      );
      handle = viewer.Viewer?.name ?? null;
    } catch {
      handle = null;
    }
    return { tokens, handle };
  }

  async refresh(tokens: TokenSet): Promise<TokenSet> {
    if (!tokens.refreshToken || !this.isConfigured()) {
      throw new ProviderAuthError('anilist', 'No refresh token available');
    }
    const { data } = await providerFetch<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>('anilist', TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: tokens.refreshToken,
      }),
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    };
  }

  async fetchLibrary(ctx: SyncContext): Promise<Page<RawEntry>> {
    if (ctx.demo) return { items: demoLibrary('anilist', ctx.userId), nextCursor: null };
    if (!this.isConfigured()) throw new NotConfiguredError('anilist');

    const viewer = await gql<{ Viewer: { id: number } }>(VIEWER_QUERY, {}, ctx.tokens.accessToken);
    const userId = viewer.Viewer.id;
    const items: RawEntry[] = [];

    for (const type of ['ANIME', 'MANGA'] as const) {
      let chunk = 1;
      let hasNext = true;
      while (hasNext) {
        const res = await gql<{
          MediaListCollection: {
            hasNextChunk: boolean;
            lists: { entries: AniListEntry[] }[];
          };
        }>(LIST_QUERY, { userId, type, chunk, perChunk: 250 }, ctx.tokens.accessToken);

        for (const list of res.MediaListCollection.lists) {
          for (const entry of list.entries) {
            const updatedAt = entry.updatedAt
              ? new Date(entry.updatedAt * 1000).toISOString()
              : new Date().toISOString();
            if (ctx.since && new Date(updatedAt) < ctx.since) continue;
            items.push({
              providerEntryId: String(entry.id),
              work: mapMedia(entry.media),
              status: toCanonicalStatus('anilist', entry.status),
              progress: entry.progress ?? 0,
              score: entry.score && entry.score > 0 ? Math.round(entry.score * 2) / 2 : null,
              repeats: entry.repeat ?? 0,
              startedAt: fuzzyToIso(entry.startedAt),
              completedAt: fuzzyToIso(entry.completedAt),
              updatedAt,
            });
          }
        }
        hasNext = res.MediaListCollection.hasNextChunk;
        chunk += 1;
      }
    }
    return { items, nextCursor: null };
  }

  async updateEntry(ctx: SyncContext, input: WritebackInput): Promise<void> {
    if (ctx.demo) return;
    if (!this.isConfigured()) throw new NotConfiguredError('anilist');
    await gql(
      SAVE_MUTATION,
      {
        mediaId: Number(input.externalWorkId),
        status: fromCanonicalStatus('anilist', input.status),
        progress: input.progress,
        score: input.score ?? 0,
      },
      ctx.tokens.accessToken,
    );
  }
}
