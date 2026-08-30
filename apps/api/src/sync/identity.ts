import type { RawWork } from '@kanzen/providers';
import type { FilterQuery } from 'mongoose';
import { Work, type WorkDoc } from '../models/index.js';

function displayTitleOf(raw: RawWork): string {
  return (
    raw.title.english ??
    raw.title.romaji ??
    raw.title.native ??
    raw.synonyms?.[0] ??
    'Untitled work'
  );
}

function normalize(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function externalIdFilter(raw: RawWork): FilterQuery<WorkDoc> | null {
  const ids = raw.externalIds ?? {};
  const or: FilterQuery<WorkDoc>[] = [];
  if (ids.anilist) or.push({ 'externalIds.anilist': ids.anilist });
  if (ids.mal) or.push({ 'externalIds.mal': ids.mal });
  if (ids.kitsu) or.push({ 'externalIds.kitsu': ids.kitsu });
  if (ids.tmdb) or.push({ 'externalIds.tmdb': ids.tmdb });
  if (ids.imdb) or.push({ 'externalIds.imdb': ids.imdb });
  if (ids.isbn) or.push({ 'externalIds.isbn': ids.isbn });
  return or.length ? { $or: or } : null;
}

/**
 * Find the canonical Work for a provider payload, or create it. Matching goes
 * external ids first, then a normalised title plus type plus release year. New
 * metadata from a provider fills gaps without clobbering existing values.
 */
export async function resolveWork(raw: RawWork): Promise<WorkDoc> {
  const idFilter = externalIdFilter(raw);
  let work = idFilter ? await Work.findOne(idFilter) : null;

  if (!work) {
    const title = displayTitleOf(raw);
    const key = normalize(title);
    const yearWindow = raw.year ? { year: { $in: [raw.year - 1, raw.year, raw.year + 1] } } : {};
    work = await Work.findOne({
      type: raw.type,
      ...yearWindow,
      $or: [
        { displayTitle: new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { synonyms: title },
      ],
    });
  }

  if (!work) {
    work = await Work.create({
      type: raw.type,
      title: raw.title,
      displayTitle: displayTitleOf(raw),
      synonyms: raw.synonyms ?? [],
      coverImage: raw.coverImage ?? null,
      bannerImage: raw.bannerImage ?? null,
      format: raw.format ?? null,
      year: raw.year ?? null,
      genres: raw.genres ?? [],
      tags: raw.tags ?? [],
      studios: raw.studios ?? [],
      episodes: raw.episodes ?? null,
      chapters: raw.chapters ?? null,
      runtime: raw.runtime ?? null,
      meanScore: raw.meanScore ?? null,
      externalIds: raw.externalIds ?? {},
      source: 'sync',
    });
    return work;
  }

  // Backfill fields the stored record is missing.
  const set: Record<string, unknown> = {};
  if (!work.coverImage && raw.coverImage) set.coverImage = raw.coverImage;
  if (!work.bannerImage && raw.bannerImage) set.bannerImage = raw.bannerImage;
  if (!work.year && raw.year) set.year = raw.year;
  if ((work.genres ?? []).length === 0 && raw.genres?.length) set.genres = raw.genres;
  if ((work.tags ?? []).length === 0 && raw.tags?.length) set.tags = raw.tags;
  if ((work.studios ?? []).length === 0 && raw.studios?.length) set.studios = raw.studios;
  if (!work.episodes && raw.episodes) set.episodes = raw.episodes;
  if (!work.chapters && raw.chapters) set.chapters = raw.chapters;
  if (!work.runtime && raw.runtime) set.runtime = raw.runtime;

  const mergedIds = { ...(work.externalIds ?? {}), ...(raw.externalIds ?? {}) };
  set.externalIds = mergedIds;

  if (Object.keys(set).length) {
    await Work.updateOne({ _id: work._id }, { $set: set });
    Object.assign(work, set);
  }
  return work;
}

/**
 * Second pass: turn provider relation edges (by external id) into Work
 * references now that every work in the batch exists.
 */
export async function linkRelations(raws: RawWork[]): Promise<void> {
  for (const raw of raws) {
    if (!raw.relations?.length) continue;
    const self = await Work.findOne(externalIdFilter(raw) ?? { _id: null });
    if (!self) continue;

    const linked: { relationType: string; work: unknown }[] = [];
    for (const rel of raw.relations) {
      const numeric = Number(rel.externalId);
      const or: FilterQuery<WorkDoc>[] = [];
      if (Number.isFinite(numeric)) {
        or.push(
          { 'externalIds.anilist': numeric },
          { 'externalIds.mal': numeric },
          { 'externalIds.tmdb': numeric },
        );
      } else {
        or.push({ 'externalIds.imdb': rel.externalId }, { displayTitle: rel.externalId });
      }
      const target = await Work.findOne({ $or: or });
      if (target && String(target._id) !== String(self._id)) {
        linked.push({ relationType: rel.relationType, work: target._id });
      }
    }
    if (linked.length) {
      await Work.updateOne({ _id: self._id }, { $set: { relations: linked } });
    }
  }
}
