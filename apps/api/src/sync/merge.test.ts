import { describe, expect, it } from 'vitest';
import { mergeSources } from './merge.js';

describe('mergeSources', () => {
  it('takes the furthest progress across providers', () => {
    const r = mergeSources([
      { provider: 'anilist', status: 'current', progress: 8, score: 8 },
      { provider: 'mal', status: 'current', progress: 12, score: 8 },
    ]);
    expect(r.progress).toBe(12);
    expect(r.hasConflict).toBe(true);
    expect(r.conflictKinds).toContain('progress');
  });

  it('does not flag a conflict when providers agree', () => {
    const r = mergeSources([
      { provider: 'anilist', status: 'completed', progress: 24, score: 9 },
      { provider: 'mal', status: 'completed', progress: 24, score: 9 },
    ]);
    expect(r.hasConflict).toBe(false);
    expect(r.status).toBe('completed');
  });

  it('flags a status conflict', () => {
    const r = mergeSources([
      { provider: 'anilist', status: 'completed', progress: 12, score: 7 },
      { provider: 'kitsu', status: 'dropped', progress: 12, score: null },
    ]);
    expect(r.conflictKinds).toContain('status');
  });

  it('flags a score conflict when ratings diverge by two or more', () => {
    const r = mergeSources([
      { provider: 'anilist', status: 'completed', progress: 12, score: 6 },
      { provider: 'mal', status: 'completed', progress: 12, score: 9 },
    ]);
    expect(r.conflictKinds).toContain('score');
    expect(r.score).toBe(7.5);
  });

  it('ignores a planning versus zero progress difference', () => {
    const r = mergeSources([
      { provider: 'anilist', status: 'planning', progress: 0, score: null },
      { provider: 'mal', status: 'current', progress: 0, score: null },
    ]);
    expect(r.conflictKinds).not.toContain('progress');
  });
});
