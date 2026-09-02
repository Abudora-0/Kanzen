import { CATALOG } from '@kanzen/providers';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { Work } from '../models/index.js';

type CoverPatch = { coverImage?: string; bannerImage?: string };

/**
 * Best effort cover art for the seeded catalogue. Pulls posters and banners
 * from public sources by external id. Any failure is swallowed and the work
 * keeps its null cover, which the UI renders as a themed placeholder. Skipped
 * entirely when SEED_SKIP_ENRICH=1.
 */
export async function enrichCovers(): Promise<{ filled: number }> {
  if (process.env.SEED_SKIP_ENRICH === '1') {
    logger.info('cover enrichment skipped (SEED_SKIP_ENRICH=1)');
    return { filled: 0 };
  }

  const patches = new Map<string, CoverPatch>();

  await Promise.allSettled([
    fillFromAniList(patches),
    fillFromTmdb(patches),
    fillFromGoogleBooks(patches),
  ]);

  let filled = 0;
  for (const [key, patch] of patches) {
    if (!patch.coverImage && !patch.bannerImage) continue;
    const item = CATALOG.find((c) => c.key === key);
    if (!item) continue;
    const match = buildMatch(item);
    if (!match) continue;
    await Work.updateOne(match, { $set: patch }).catch(() => undefined);
    filled += 1;
  }
  logger.info({ filled }, 'cover enrichment complete');
  return { filled };
}

function buildMatch(item: (typeof CATALOG)[number]): Record<string, unknown> | null {
  const ids = item.externalIds ?? {};
  if (ids.anilist) return { 'externalIds.anilist': ids.anilist };
  if (ids.tmdb) return { 'externalIds.tmdb': ids.tmdb };
  if (ids.isbn) return { 'externalIds.isbn': ids.isbn };
  return null;
}

async function fillFromAniList(patches: Map<string, CoverPatch>): Promise<void> {
  const ids = CATALOG.filter((c) => c.externalIds?.anilist).map((c) => c.externalIds!.anilist!);
  if (ids.length === 0) return;
  const query = `query ($ids: [Int]) {
    Page(perPage: 50) { media(id_in: $ids) { id coverImage { extraLarge large } bannerImage } }
  }`;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query, variables: { ids } }),
  });
  if (!res.ok) throw new Error(`anilist ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      Page?: {
        media?: {
          id: number;
          coverImage?: { extraLarge?: string; large?: string };
          bannerImage?: string | null;
        }[];
      };
    };
  };
  const media = json.data?.Page?.media ?? [];
  for (const m of media) {
    const item = CATALOG.find((c) => c.externalIds?.anilist === m.id);
    if (!item) continue;
    patches.set(item.key, {
      coverImage: m.coverImage?.extraLarge ?? m.coverImage?.large,
      bannerImage: m.bannerImage ?? undefined,
    });
  }
}

async function fillFromTmdb(patches: Map<string, CoverPatch>): Promise<void> {
  const token = env.TMDB_READ_TOKEN;
  if (!token) return;
  const movies = CATALOG.filter((c) => c.externalIds?.tmdb);
  await Promise.allSettled(
    movies.map(async (item) => {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${item.externalIds!.tmdb}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      });
      if (!res.ok) return;
      const m = (await res.json()) as {
        poster_path?: string | null;
        backdrop_path?: string | null;
      };
      patches.set(item.key, {
        coverImage: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined,
        bannerImage: m.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}`
          : undefined,
      });
    }),
  );
}

async function fillFromGoogleBooks(patches: Map<string, CoverPatch>): Promise<void> {
  const books = CATALOG.filter((c) => c.externalIds?.isbn);
  await Promise.allSettled(
    books.map(async (item) => {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${item.externalIds!.isbn}&country=US`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        items?: { volumeInfo?: { imageLinks?: { thumbnail?: string; smallThumbnail?: string } } }[];
      };
      const link =
        json.items?.[0]?.volumeInfo?.imageLinks?.thumbnail ??
        json.items?.[0]?.volumeInfo?.imageLinks?.smallThumbnail;
      if (!link) return;
      patches.set(item.key, {
        coverImage: link
          .replace(/^http:/, 'https:')
          .replace(/&edge=curl/, '')
          .replace(/zoom=\d/, 'zoom=2'),
      });
    }),
  );
}
