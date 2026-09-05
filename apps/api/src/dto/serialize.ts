import type { ConnectionDto, EntryDto, SyncRunDto, UserDto, WorkDto } from '@kanzen/shared';
import { coerceAccent } from '@kanzen/shared';
import type { ConnectionDoc, EntryDoc, SyncRunDoc, UserDoc, WorkDoc } from '../models/index.js';

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

export function serializeUser(user: UserDoc): UserDto {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    isDemo: Boolean(user.isDemo),
    settings: {
      reduceMotion: Boolean(user.settings?.reduceMotion),
      soundFx: Boolean(user.settings?.soundFx),
      customCursor: Boolean(user.settings?.customCursor),
      accent: coerceAccent(user.settings?.accent),
    },
    createdAt: iso(user.get('createdAt')) ?? new Date().toISOString(),
  };
}

export function serializeWork(work: WorkDoc): WorkDto {
  const title = {
    romaji: work.title?.romaji ?? undefined,
    english: work.title?.english ?? undefined,
    native: work.title?.native ?? undefined,
  };
  return {
    id: String(work._id),
    type: work.type,
    title,
    displayTitle: work.displayTitle,
    coverImage: work.coverImage ?? null,
    bannerImage: work.bannerImage ?? null,
    format: work.format ?? null,
    year: work.year ?? null,
    genres: work.genres ?? [],
    tags: work.tags ?? [],
    studios: work.studios ?? [],
    episodes: work.episodes ?? null,
    chapters: work.chapters ?? null,
    runtime: work.runtime ?? null,
    meanScore: work.meanScore ?? null,
    externalIds: {
      anilist: work.externalIds?.anilist ?? undefined,
      mal: work.externalIds?.mal ?? undefined,
      kitsu: work.externalIds?.kitsu ?? undefined,
      tmdb: work.externalIds?.tmdb ?? undefined,
      imdb: work.externalIds?.imdb ?? undefined,
      isbn: work.externalIds?.isbn ?? undefined,
    },
    relations: (work.relations ?? []).map((rel) => {
      const populated = rel.work as unknown as { _id: unknown; displayTitle?: string };
      return {
        relationType: rel.relationType,
        workId: String(populated?._id ?? rel.work),
        displayTitle: populated?.displayTitle ?? '',
      };
    }),
  };
}

export function serializeEntry(entry: EntryDoc, work: WorkDoc): EntryDto {
  return {
    id: String(entry._id),
    work: serializeWork(work),
    status: entry.status,
    progress: entry.progress ?? 0,
    progressMax: entry.progressMax ?? null,
    score: entry.score ?? null,
    repeats: entry.repeats ?? 0,
    notes: entry.notes ?? '',
    startedAt: iso(entry.startedAt),
    completedAt: iso(entry.completedAt),
    updatedAt: iso(entry.get('updatedAt')) ?? new Date().toISOString(),
    sources: (entry.sources ?? []).map((s) => ({
      provider: s.provider,
      status: s.status,
      progress: s.progress ?? 0,
      score: s.score ?? null,
      syncedAt: iso(s.syncedAt) ?? new Date().toISOString(),
      dirty: Boolean(s.dirty),
    })),
    hasConflict: Boolean(entry.hasConflict),
  };
}

export function serializeConnection(conn: ConnectionDoc, entryCount: number): ConnectionDto {
  return {
    id: String(conn._id),
    provider: conn.provider,
    handle: conn.handle ?? null,
    status: conn.status,
    lastSyncedAt: iso(conn.lastSyncedAt),
    entryCount,
  };
}

export function serializeSyncRun(run: SyncRunDoc): SyncRunDto {
  return {
    id: String(run._id),
    provider: run.provider,
    mode: run.mode,
    state: run.state,
    startedAt: iso(run.startedAt),
    finishedAt: iso(run.finishedAt),
    stats: {
      fetched: run.stats?.fetched ?? 0,
      created: run.stats?.created ?? 0,
      updated: run.stats?.updated ?? 0,
      conflicts: run.stats?.conflicts ?? 0,
    },
    error: run.error ?? null,
  };
}
