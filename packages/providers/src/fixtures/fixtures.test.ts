import { describe, expect, it } from 'vitest';
import { CATALOG, CATALOG_BY_KEY, demoLibrary } from './index.js';

describe('catalog', () => {
  it('has unique keys', () => {
    const keys = new Set(CATALOG.map((c) => c.key));
    expect(keys.size).toBe(CATALOG.length);
  });

  it('only references relations that exist', () => {
    for (const item of CATALOG) {
      for (const rel of item.relations ?? []) {
        expect(CATALOG_BY_KEY[rel.key], `${item.key} -> ${rel.key}`).toBeDefined();
      }
    }
  });
});

describe('demoLibrary', () => {
  it('is deterministic for a given seed', () => {
    const a = demoLibrary('anilist', 'user-123');
    const b = demoLibrary('anilist', 'user-123');
    expect(a).toEqual(b);
  });

  it('produces different libraries per user', () => {
    const a = demoLibrary('anilist', 'user-a');
    const b = demoLibrary('anilist', 'user-b');
    expect(a.map((e) => e.providerEntryId)).not.toEqual(b.map((e) => e.providerEntryId));
  });

  it('only returns media the provider supports', () => {
    for (const entry of demoLibrary('tmdb', 'seed')) {
      expect(entry.work.type).toBe('movie');
    }
    for (const entry of demoLibrary('anilist', 'seed')) {
      expect(['anime', 'manga']).toContain(entry.work.type);
    }
  });

  it('keeps progress within the work total', () => {
    for (const entry of demoLibrary('anilist', 'seed-x')) {
      const max = entry.work.episodes ?? entry.work.chapters ?? Number.MAX_SAFE_INTEGER;
      expect(entry.progress).toBeLessThanOrEqual(max);
    }
  });
});
