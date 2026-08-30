import type { EntryStatus } from '@kanzen/shared';

export type MergeSource = {
  provider: string;
  status: EntryStatus;
  progress: number;
  score: number | null;
};

export type MergeResult = {
  status: EntryStatus;
  progress: number;
  score: number | null;
  hasConflict: boolean;
  conflictKinds: string[];
};

const STATUS_RANK: Record<EntryStatus, number> = {
  planning: 0,
  current: 1,
  paused: 2,
  dropped: 3,
  repeating: 4,
  completed: 5,
};

/**
 * Combine the per provider view of one entry into a single canonical value and
 * flag the ways the providers disagree. The merge favours the furthest
 * progress, which is what a cross platform tracker should surface.
 */
export function mergeSources(sources: MergeSource[]): MergeResult {
  if (sources.length === 0) {
    return { status: 'planning', progress: 0, score: null, hasConflict: false, conflictKinds: [] };
  }

  const progresses = sources.map((s) => s.progress);
  const maxProgress = Math.max(...progresses);
  const minProgress = Math.min(...progresses);

  const furthest = [...sources].sort(
    (a, b) => b.progress - a.progress || STATUS_RANK[b.status] - STATUS_RANK[a.status],
  )[0]!;

  const status: EntryStatus = furthest.status;

  const rated = sources.map((s) => s.score).filter((s): s is number => s != null && s > 0);
  const score = rated.length
    ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 2) / 2
    : null;

  const conflictKinds: string[] = [];
  const distinctStatuses = new Set(sources.map((s) => s.status));
  if (
    distinctStatuses.size > 1 &&
    !(distinctStatuses.size === 2 && distinctStatuses.has('planning') && maxProgress === 0)
  ) {
    conflictKinds.push('status');
  }
  if (maxProgress - minProgress >= 2 && maxProgress - minProgress > maxProgress * 0.08) {
    conflictKinds.push('progress');
  }
  if (rated.length > 1 && Math.max(...rated) - Math.min(...rated) >= 2) {
    conflictKinds.push('score');
  }

  return {
    status,
    progress: maxProgress,
    score,
    hasConflict: conflictKinds.length > 0,
    conflictKinds,
  };
}
