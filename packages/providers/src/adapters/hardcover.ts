import type { EntryStatus, ProviderId } from '@kanzen/shared';
import { PROVIDERS, fromCanonicalStatus, toCanonicalStatus } from '@kanzen/shared';
import { NotConfiguredError, ProviderAuthError } from '../errors.js';
import { providerFetch, normaliseScore } from '../http.js';
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

const API = 'https://api.hardcover.app/v1/graphql';
const PAGE_SIZE = 50;
// Hardcover status_id 6 is "Ignored" (a dismissed recommendation, not a
// tracked read), so it is excluded at the query level rather than mapped.
const IGNORED_STATUS = 6;

type GqlResponse<T> = { data?: T; errors?: { message: string }[] };

function authHeader(token: string): string {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

async function gql<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { data } = await providerFetch<GqlResponse<T>>('hardcover', API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader(token) },
    body: JSON.stringify(variables ? { query, variables } : { query }),
  });
  if (data.errors?.length) throw new ProviderAuthError('hardcover', data.errors[0]!.message);
  if (!data.data) throw new ProviderAuthError('hardcover', 'Hardcover returned no data');
  return data.data;
}

type HcBook = {
  id: number;
  title: string;
  pages: number | null;
  release_year: number | null;
  image: { url: string } | null;
};
type HcUserBook = {
  id: number;
  status_id: number;
  rating: number | null;
  read_count: number;
  updated_at: string;
  book: HcBook;
  user_book_reads: { progress_pages: number | null }[];
};

function mapBook(book: HcBook): RawWork {
  return {
    externalId: String(book.id),
    externalIds: { hardcover: book.id },
    type: 'book',
    title: { english: book.title },
    coverImage: book.image?.url ?? null,
    bannerImage: null,
    format: null,
    year: book.release_year,
    genres: [],
    tags: [],
    studios: [],
    episodes: null,
    chapters: book.pages,
    runtime: null,
    meanScore: null,
    relations: [],
  };
}

function mapStatus(ub: HcUserBook): EntryStatus {
  // Hardcover has no distinct "rereading" status; a second read in progress
  // is a currently-reading row with a completed read already on record.
  if (ub.status_id === 2 && ub.read_count > 0) return 'repeating';
  return toCanonicalStatus('hardcover', String(ub.status_id));
}

/**
 * Hardcover's beta API is a personal-access-token only GraphQL endpoint: no
 * OAuth app to register, so users paste a token generated on their own
 * account settings page. It only tracks books.
 */
export class HardcoverProvider implements MediaProvider {
  id: ProviderId = 'hardcover';
  meta = PROVIDERS.hardcover;

  isConfigured(): boolean {
    return true;
  }

  getAuthUrl(): string {
    throw new NotConfiguredError('hardcover');
  }

  async exchangeCode(): Promise<{ tokens: TokenSet; handle: string | null }> {
    throw new NotConfiguredError('hardcover');
  }

  async exchangeCredentials(input: {
    token?: string;
  }): Promise<{ tokens: TokenSet; handle: string | null }> {
    const token = input.token?.trim();
    if (!token) throw new ProviderAuthError('hardcover', 'A Hardcover API token is required');
    const data = await gql<{ me: { id: number; username: string }[] }>(
      token,
      'query { me { id username } }',
    );
    const me = data.me?.[0];
    if (!me) throw new ProviderAuthError('hardcover', 'Hardcover rejected that token');
    return {
      tokens: { accessToken: token, accountId: String(me.id) },
      handle: me.username ?? null,
    };
  }

  async refresh(tokens: TokenSet): Promise<TokenSet> {
    // Personal access tokens have a user-set expiry and no refresh flow; a
    // truly expired token surfaces as an auth error on the next request.
    return tokens;
  }

  async fetchLibrary(ctx: SyncContext, cursor?: string | null): Promise<Page<RawEntry>> {
    if (ctx.demo) return { items: demoLibrary('hardcover', ctx.userId), nextCursor: null };
    const offset = cursor ? Number(cursor) : 0;
    const data = await gql<{ me: { user_books: HcUserBook[] }[] }>(
      ctx.tokens.accessToken,
      `query Library($limit: Int!, $offset: Int!, $ignored: Int!) {
        me {
          user_books(
            where: { status_id: { _neq: $ignored } }
            limit: $limit
            offset: $offset
            order_by: { updated_at: desc }
          ) {
            id
            status_id
            rating
            read_count
            updated_at
            book { id title pages release_year image { url } }
            user_book_reads(order_by: { started_at: desc }, limit: 1) { progress_pages }
          }
        }
      }`,
      { limit: PAGE_SIZE, offset, ignored: IGNORED_STATUS },
    );
    const rows = data.me?.[0]?.user_books ?? [];
    const items: RawEntry[] = rows
      .filter((ub) => !ctx.since || new Date(ub.updated_at) >= ctx.since)
      .map((ub) => ({
        providerEntryId: String(ub.id),
        work: mapBook(ub.book),
        status: mapStatus(ub),
        progress: ub.user_book_reads[0]?.progress_pages ?? 0,
        score: normaliseScore(ub.rating, 5),
        repeats: Math.max(0, ub.read_count - 1),
        startedAt: null,
        completedAt: null,
        updatedAt: ub.updated_at,
      }));
    return { items, nextCursor: rows.length === PAGE_SIZE ? String(offset + PAGE_SIZE) : null };
  }

  async updateEntry(ctx: SyncContext, input: WritebackInput): Promise<void> {
    if (ctx.demo) return;
    const statusId = fromCanonicalStatus('hardcover', input.status);
    const object: Record<string, unknown> = {};
    if (statusId) object.status_id = Number(statusId);
    if (input.score != null) object.rating = Math.round((input.score / 2) * 2) / 2;

    if (Object.keys(object).length > 0) {
      await gql(
        ctx.tokens.accessToken,
        `mutation ($id: Int!, $object: UserBookUpdateInput!) {
          update_user_book(id: $id, object: $object) { id }
        }`,
        { id: Number(input.providerEntryId), object },
      );
    }

    const existing = await gql<{ user_book_reads: { id: number }[] }>(
      ctx.tokens.accessToken,
      `query ($userBookId: Int!) {
        user_book_reads(
          where: { user_book_id: { _eq: $userBookId } }
          order_by: { started_at: desc }
          limit: 1
        ) { id }
      }`,
      { userBookId: Number(input.providerEntryId) },
    );
    const readId = existing.user_book_reads[0]?.id;
    if (readId) {
      await gql(
        ctx.tokens.accessToken,
        `mutation ($id: Int!, $object: DatesReadInput!) {
          update_user_book_read(id: $id, object: $object) { id }
        }`,
        { id: readId, object: { progress_pages: input.progress } },
      );
    } else {
      await gql(
        ctx.tokens.accessToken,
        `mutation ($userBookId: Int!, $read: DatesReadInput!) {
          insert_user_book_read(user_book_id: $userBookId, user_book_read: $read) { id }
        }`,
        { userBookId: Number(input.providerEntryId), read: { progress_pages: input.progress } },
      );
    }
  }
}
