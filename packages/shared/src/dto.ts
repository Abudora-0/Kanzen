import type { EntryStatus } from './status.js';
import type { ConnectionStatus, ProviderId } from './providers.js';
import type { ExternalIds, MediaType, TitleSet } from './media.js';
import type { Accent } from './theme.js';

export type UserDto = {
  id: string;
  email: string;
  displayName: string;
  isDemo: boolean;
  settings: {
    reduceMotion: boolean;
    soundFx: boolean;
    customCursor: boolean;
    accent: Accent;
  };
  createdAt: string;
};

export type ConnectionDto = {
  id: string;
  provider: ProviderId;
  handle: string | null;
  status: ConnectionStatus;
  lastSyncedAt: string | null;
  entryCount: number;
};

export type WorkDto = {
  id: string;
  type: MediaType;
  title: TitleSet;
  displayTitle: string;
  coverImage: string | null;
  bannerImage: string | null;
  format: string | null;
  year: number | null;
  genres: string[];
  tags: string[];
  studios: string[];
  episodes: number | null;
  chapters: number | null;
  runtime: number | null;
  meanScore: number | null;
  externalIds: ExternalIds;
  relations: { relationType: string; workId: string; displayTitle: string }[];
};

export type EntrySourceDto = {
  provider: ProviderId;
  status: EntryStatus;
  progress: number;
  score: number | null;
  syncedAt: string;
  dirty: boolean;
};

export type EntryDto = {
  id: string;
  work: WorkDto;
  status: EntryStatus;
  progress: number;
  progressMax: number | null;
  score: number | null;
  repeats: number;
  notes: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  sources: EntrySourceDto[];
  hasConflict: boolean;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type SyncRunDto = {
  id: string;
  provider: ProviderId;
  mode: 'full' | 'incremental';
  state: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  startedAt: string | null;
  finishedAt: string | null;
  stats: { fetched: number; created: number; updated: number; conflicts: number };
  error: string | null;
};

/** Server sent event payloads on GET /api/stream. */
export type StreamEvent =
  | { type: 'sync:progress'; provider: ProviderId; runId: string; done: number; total: number }
  | { type: 'sync:state'; provider: ProviderId; runId: string; state: SyncRunDto['state'] }
  | {
      type: 'limiter';
      provider: ProviderId;
      remaining: number;
      reservoir: number;
      queued: number;
    }
  | { type: 'insights:ready'; generatedAt: string }
  | { type: 'hello'; now: string };
