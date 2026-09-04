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

const AUTHORIZE_URL = 'https://myanimelist.net/v1/oauth2/authorize';
const TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
const API = 'https://api.myanimelist.net/v2';

const ANIME_FIELDS =
  'list_status{status,score,num_episodes_watched,is_rewatching,num_times_rewatched,updated_at,start_date,finish_date},num_episodes,media_type,start_season,mean,genres,alternative_titles,main_picture';
const MANGA_FIELDS =
  'list_status{status,score,num_chapters_read,is_rereading,num_times_reread,updated_at,start_date,finish_date},num_chapters,media_type,mean,genres,alternative_titles,main_picture';

type MalNode = {
  id: number;
  title: string;
  main_picture?: { medium?: string; large?: string } | null;
  alternative_titles?: { en?: string; ja?: string; synonyms?: string[] } | null;
  media_type?: string | null;
  start_season?: { year?: number | null } | null;
  mean?: number | null;
  genres?: { name: string }[] | null;
  num_episodes?: number | null;
  num_chapters?: number | null;
};

type MalListStatus = {
  status: string;
  score: number;
  num_episodes_watched?: number;
  num_chapters_read?: number;
  is_rewatching?: boolean;
  is_rereading?: boolean;
  num_times_rewatched?: number;
  num_times_reread?: number;
  updated_at: string;
  start_date?: string | null;
  finish_date?: string | null;
};

type MalListItem = { node: MalNode; list_status: MalListStatus };
type MalListPage = { data: MalListItem[]; paging?: { next?: string } };

const FORM = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };

function mapNode(node: MalNode, type: MediaType): RawWork {
  return {
    externalId: String(node.id),
    externalIds: { mal: node.id },
    type,
    title: {
      romaji: node.title || undefined,
      english: node.alternative_titles?.en || undefined,
      native: node.alternative_titles?.ja || undefined,
    },
    synonyms: node.alternative_titles?.synonyms ?? [],
    coverImage: node.main_picture?.large ?? node.main_picture?.medium ?? null,
    bannerImage: null,
    format: node.media_type ? node.media_type.toUpperCase() : null,
    year: node.start_season?.year ?? null,
    genres: (node.genres ?? []).map((g) => g.name),
    tags: [],
    studios: [],
    episodes: type === 'anime' ? (node.num_episodes ?? null) : null,
    chapters: type === 'manga' ? (node.num_chapters ?? null) : null,
    runtime: null,
    meanScore: node.mean ?? null,
    relations: [],
  };
}

function mapItem(item: MalListItem, type: MediaType): RawEntry {
  const ls = item.list_status;
  const rewatching = ls.is_rewatching || ls.is_rereading;
  const status = rewatching ? 'repeating' : toCanonicalStatus('mal', ls.status);
  return {
    providerEntryId: `mal-${type}-${item.node.id}`,
    work: mapNode(item.node, type),
    status,
    progress: (type === 'anime' ? ls.num_episodes_watched : ls.num_chapters_read) ?? 0,
    score: ls.score && ls.score > 0 ? ls.score : null,
    repeats: ls.num_times_rewatched ?? ls.num_times_reread ?? 0,
    startedAt: ls.start_date ? `${ls.start_date}T00:00:00.000Z` : null,
    completedAt: ls.finish_date ? `${ls.finish_date}T00:00:00.000Z` : null,
    updatedAt: ls.updated_at ?? new Date().toISOString(),
  };
}

export class MalProvider implements MediaProvider {
  id: ProviderId = 'mal';
  meta = PROVIDERS.mal;

  constructor(private config: { clientId?: string; clientSecret?: string } = {}) {}

  isConfigured(): boolean {
    return Boolean(this.config.clientId);
  }

  getAuthUrl(input: { state: string; pkce: { verifier: string }; redirectUri: string }): string {
    if (!this.config.clientId) throw new NotConfiguredError('mal');
    // MAL only supports the "plain" PKCE method, so the challenge is the verifier.
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      code_challenge: input.pkce.verifier,
      code_challenge_method: 'plain',
      state: input.state,
      redirect_uri: input.redirectUri,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  private tokenBody(extra: Record<string, string>): string {
    const body = new URLSearchParams({ client_id: this.config.clientId ?? '', ...extra });
    if (this.config.clientSecret) body.set('client_secret', this.config.clientSecret);
    return body.toString();
  }

  async exchangeCode(input: {
    code: string;
    verifier: string;
    redirectUri: string;
  }): Promise<{ tokens: TokenSet; handle: string | null }> {
    if (!this.isConfigured()) throw new NotConfiguredError('mal');
    const { data } = await providerFetch<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
    }>('mal', TOKEN_URL, {
      method: 'POST',
      headers: FORM,
      body: this.tokenBody({
        grant_type: 'authorization_code',
        code: input.code,
        code_verifier: input.verifier,
        redirect_uri: input.redirectUri,
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
      const { data: me } = await providerFetch<{ name: string }>('mal', `${API}/users/@me`, {
        headers: { authorization: `Bearer ${tokens.accessToken}` },
      });
      handle = me.name ?? null;
    } catch {
      handle = null;
    }
    return { tokens, handle };
  }

  async refresh(tokens: TokenSet): Promise<TokenSet> {
    if (!tokens.refreshToken || !this.isConfigured()) {
      throw new ProviderAuthError('mal', 'No refresh token available');
    }
    const { data } = await providerFetch<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>('mal', TOKEN_URL, {
      method: 'POST',
      headers: FORM,
      body: this.tokenBody({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken }),
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    };
  }

  async fetchLibrary(ctx: SyncContext): Promise<Page<RawEntry>> {
    if (ctx.demo) return { items: demoLibrary('mal', ctx.userId), nextCursor: null };
    if (!this.isConfigured()) throw new NotConfiguredError('mal');

    const items: RawEntry[] = [];
    const auth = { authorization: `Bearer ${ctx.tokens.accessToken}` };

    const pull = async (kind: 'anime' | 'manga') => {
      const fields = kind === 'anime' ? ANIME_FIELDS : MANGA_FIELDS;
      let url: string | undefined =
        `${API}/users/@me/${kind}list?fields=${encodeURIComponent(fields)}&limit=1000&nsfw=true`;
      let guard = 0;
      while (url && guard < 20) {
        const { data }: { data: MalListPage } = await providerFetch<MalListPage>('mal', url, {
          headers: auth,
        });
        for (const item of data.data ?? []) {
          const entry = mapItem(item, kind);
          if (ctx.since && new Date(entry.updatedAt) < ctx.since) continue;
          items.push(entry);
        }
        url = data.paging?.next;
        guard += 1;
      }
    };

    await pull('anime');
    await pull('manga');
    return { items, nextCursor: null };
  }

  async updateEntry(ctx: SyncContext, input: WritebackInput): Promise<void> {
    if (ctx.demo) return;
    if (!this.isConfigured()) throw new NotConfiguredError('mal');
    const kind = input.providerEntryId.startsWith('mal-manga') ? 'manga' : 'anime';
    const status = fromCanonicalStatus('mal', input.status);
    const body: Record<string, string> = {};
    if (status) body.status = status;
    if (input.score != null) body.score = String(Math.round(input.score));
    body[kind === 'anime' ? 'num_watched_episodes' : 'num_chapters_read'] = String(input.progress);
    await providerFetch('mal', `${API}/${kind}/${input.externalWorkId}/my_list_status`, {
      method: 'PUT',
      headers: { ...FORM, authorization: `Bearer ${ctx.tokens.accessToken}` },
      body: new URLSearchParams(body).toString(),
    });
  }
}
