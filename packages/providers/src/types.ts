import type {
  EntryStatus,
  ExternalIds,
  MediaType,
  ProviderId,
  ProviderMeta,
  TitleSet,
  WorkRelation,
} from '@kanzen/shared';

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  /** Epoch milliseconds. */
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
  /** Provider account identifier, used by TMDB which keys lists by account id. */
  accountId?: string;
};

export type PkcePair = { verifier: string; challenge: string };

export type RawWork = {
  /** The provider's own id, always stored as a string. */
  externalId: string;
  externalIds?: Partial<ExternalIds>;
  type: MediaType;
  title: TitleSet;
  synonyms?: string[];
  coverImage?: string | null;
  bannerImage?: string | null;
  format?: string | null;
  year?: number | null;
  genres?: string[];
  tags?: string[];
  studios?: string[];
  episodes?: number | null;
  chapters?: number | null;
  runtime?: number | null;
  meanScore?: number | null;
  relations?: { relationType: WorkRelation['relationType']; externalId: string }[];
};

export type RawEntry = {
  work: RawWork;
  status: EntryStatus;
  progress: number;
  /** Normalised to a 0 to 10 scale, or null when unrated. */
  score: number | null;
  repeats?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt: string;
  providerEntryId: string;
};

export type Page<T> = { items: T[]; nextCursor?: string | null };

export type SyncContext = {
  userId: string;
  connectionId: string;
  handle?: string | null;
  tokens: TokenSet;
  /** Incremental cutoff. Entries not touched since this are skipped. */
  since?: Date | null;
  demo: boolean;
  log: (message: string, meta?: Record<string, unknown>) => void;
};

export type WritebackInput = {
  providerEntryId: string;
  externalWorkId: string;
  status: EntryStatus;
  progress: number;
  score: number | null;
};

export interface MediaProvider {
  id: ProviderId;
  meta: ProviderMeta;
  /** True when the required client id and secret are present. */
  isConfigured(): boolean;
  getAuthUrl(input: {
    state: string;
    pkce: PkcePair;
    redirectUri: string;
  }): string | Promise<string>;
  exchangeCode(input: {
    code: string;
    verifier: string;
    redirectUri: string;
  }): Promise<{ tokens: TokenSet; handle: string | null }>;
  /**
   * For providers with no redirect OAuth (Kitsu). Trades a username and password
   * for a token once; the password is never stored.
   */
  exchangeCredentials?(input: {
    username: string;
    password: string;
  }): Promise<{ tokens: TokenSet; handle: string | null }>;
  refresh(tokens: TokenSet): Promise<TokenSet>;
  fetchLibrary(ctx: SyncContext, cursor?: string | null): Promise<Page<RawEntry>>;
  updateEntry(ctx: SyncContext, input: WritebackInput): Promise<void>;
}
