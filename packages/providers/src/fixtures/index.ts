import type { EntryStatus, MediaType, ProviderId } from '@kanzen/shared';
import { PROVIDERS } from '@kanzen/shared';
import type { RawEntry, RawWork } from '../types.js';
import { CATALOG, CATALOG_BY_KEY, type CatalogItem } from './catalog.js';
import { makeRng } from './rng.js';

export { CATALOG, CATALOG_BY_KEY } from './catalog.js';
export type { CatalogItem } from './catalog.js';

function unitTotal(item: CatalogItem): number {
  if (item.type === 'movie' || item.format === 'Movie') return 1;
  if (item.type === 'book') return item.runtime ?? 300;
  if (item.type === 'anime') return item.episodes ?? 12;
  return item.chapters ?? 100;
}

export function catalogToRawWork(item: CatalogItem, provider: ProviderId): RawWork {
  const providerExternalId =
    provider === 'tmdb'
      ? String(item.externalIds?.tmdb ?? item.key)
      : provider === 'mal'
        ? String(item.externalIds?.mal ?? item.key)
        : provider === 'hardcover'
          ? String(item.externalIds?.hardcover ?? item.key)
          : String(item.externalIds?.anilist ?? item.key);

  return {
    externalId: providerExternalId,
    externalIds: item.externalIds,
    type: item.type,
    title: item.title,
    synonyms: item.synonyms,
    coverImage: null,
    bannerImage: null,
    format: item.format,
    year: item.year,
    genres: item.genres,
    tags: item.tags,
    studios: item.studios,
    episodes: item.type === 'anime' ? (item.episodes ?? null) : null,
    chapters: item.type === 'manga' ? (item.chapters ?? null) : null,
    runtime: item.type === 'movie' || item.type === 'book' ? (item.runtime ?? null) : null,
    meanScore: item.meanScore,
    relations: (item.relations ?? [])
      .map((rel) => {
        const target = CATALOG_BY_KEY[rel.key];
        if (!target) return null;
        const targetId =
          provider === 'tmdb'
            ? String(target.externalIds?.tmdb ?? target.key)
            : provider === 'mal'
              ? String(target.externalIds?.mal ?? target.key)
              : provider === 'hardcover'
                ? String(target.externalIds?.hardcover ?? target.key)
                : String(target.externalIds?.anilist ?? target.key);
        return { relationType: rel.relationType, externalId: targetId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

function statusFromProgress(ratio: number, rng: () => number): EntryStatus {
  if (ratio >= 1) return rng() < 0.12 ? 'repeating' : 'completed';
  if (ratio <= 0) return 'planning';
  if (rng() < 0.14) return 'paused';
  if (rng() < 0.08) return 'dropped';
  return 'current';
}

/**
 * Fixed reference point so fixture libraries are byte for byte deterministic.
 * The seed script can rebase these onto the real calendar if needed.
 */
export const FIXTURE_NOW = Date.parse('2026-08-15T00:00:00.000Z');

function isoDaysAgo(days: number): string {
  return new Date(FIXTURE_NOW - days * 86_400_000).toISOString();
}

/**
 * Deterministic fake remote library for a provider. Overlapping works across
 * providers are given slightly different progress so the sync engine has real
 * cross-platform conflicts to detect.
 */
export function demoLibrary(provider: ProviderId, seed: string): RawEntry[] {
  const rng = makeRng(`${provider}:${seed}`);
  const media = new Set<MediaType>(PROVIDERS[provider].media);
  const drift = provider === 'mal' ? 0.82 : provider === 'kitsu' ? 0.55 : 1;
  const inclusion = provider === 'kitsu' ? 0.4 : provider === 'mal' ? 0.6 : 0.78;

  const entries: RawEntry[] = [];
  for (const item of CATALOG) {
    if (!media.has(item.type)) continue;
    if (rng() > inclusion) continue;

    const total = unitTotal(item);
    const single = item.type === 'movie' || item.format === 'Movie';
    const baseRatio = Math.min(1, Math.max(0, rng() * 1.15 - 0.05));
    const ratio = Math.min(1, baseRatio * drift + (provider === 'anilist' ? 0 : rng() * 0.06));
    const progress = single ? (ratio >= 0.6 ? 1 : 0) : Math.round(ratio * total);
    const realRatio = single ? progress : total > 0 ? progress / total : 0;
    const status = statusFromProgress(realRatio, rng);
    const rated = status === 'completed' || status === 'repeating' || rng() < 0.4;
    const score = rated
      ? Math.round(Math.min(10, Math.max(3, item.meanScore + (rng() - 0.5) * 2.6)) * 2) / 2
      : null;
    const updatedDays = Math.floor(rng() * 420);

    entries.push({
      providerEntryId: `${provider}-${item.key}`,
      work: catalogToRawWork(item, provider),
      status,
      progress: status === 'planning' ? 0 : progress,
      score,
      repeats: status === 'repeating' ? 1 : 0,
      startedAt: status === 'planning' ? null : isoDaysAgo(updatedDays + Math.floor(rng() * 200)),
      completedAt:
        status === 'completed' || status === 'repeating' ? isoDaysAgo(updatedDays) : null,
      updatedAt: isoDaysAgo(updatedDays),
    });
  }
  return entries;
}
