import type { ProviderId } from './providers.js';

/** Kanzen's canonical list statuses. Every provider status maps onto one of these. */
export const ENTRY_STATUSES = [
  'planning',
  'current',
  'paused',
  'dropped',
  'completed',
  'repeating',
] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const STATUS_LABEL: Record<EntryStatus, string> = {
  planning: 'Planning',
  current: 'In progress',
  paused: 'On hold',
  dropped: 'Dropped',
  completed: 'Completed',
  repeating: 'Revisiting',
};

/** Order used for the status funnel visual. */
export const STATUS_ORDER: EntryStatus[] = [
  'planning',
  'current',
  'repeating',
  'paused',
  'dropped',
  'completed',
];

type StatusMap = Record<string, EntryStatus>;

/** Provider status string -> canonical status. */
const PROVIDER_STATUS_IN: Record<ProviderId, StatusMap> = {
  anilist: {
    PLANNING: 'planning',
    CURRENT: 'current',
    PAUSED: 'paused',
    DROPPED: 'dropped',
    COMPLETED: 'completed',
    REPEATING: 'repeating',
  },
  mal: {
    plan_to_watch: 'planning',
    plan_to_read: 'planning',
    watching: 'current',
    reading: 'current',
    on_hold: 'paused',
    dropped: 'dropped',
    completed: 'completed',
  },
  kitsu: {
    planned: 'planning',
    current: 'current',
    on_hold: 'paused',
    dropped: 'dropped',
    completed: 'completed',
  },
  tmdb: {
    watchlist: 'planning',
    watched: 'completed',
    favorite: 'current',
  },
};

/** Canonical status -> provider status string. */
const PROVIDER_STATUS_OUT: Record<ProviderId, Partial<Record<EntryStatus, string>>> = {
  anilist: {
    planning: 'PLANNING',
    current: 'CURRENT',
    paused: 'PAUSED',
    dropped: 'DROPPED',
    completed: 'COMPLETED',
    repeating: 'REPEATING',
  },
  mal: {
    planning: 'plan_to_watch',
    current: 'watching',
    paused: 'on_hold',
    dropped: 'dropped',
    completed: 'completed',
    repeating: 'watching',
  },
  kitsu: {
    planning: 'planned',
    current: 'current',
    paused: 'on_hold',
    dropped: 'dropped',
    completed: 'completed',
    repeating: 'current',
  },
  tmdb: {
    planning: 'watchlist',
    completed: 'watched',
  },
};

export function toCanonicalStatus(provider: ProviderId, raw: string): EntryStatus {
  return PROVIDER_STATUS_IN[provider][raw] ?? 'planning';
}

export function fromCanonicalStatus(provider: ProviderId, status: EntryStatus): string | undefined {
  return PROVIDER_STATUS_OUT[provider][status];
}
