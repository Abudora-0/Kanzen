import { useMemo } from 'react';
import type { EntryDto } from '@kanzen/shared';
import type { ConstellationLink, ConstellationNode } from '../components/Constellation';
import { titleOf } from './utils';

/** Turn a list of entries into constellation nodes and franchise link edges. */
export function useConstellationData(entries: EntryDto[]) {
  return useMemo(() => {
    const nodes: ConstellationNode[] = entries.map((e) => ({
      id: e.id,
      title: titleOf(e.work),
      type: e.work.type,
      status: e.status,
      progress: e.progress,
      score: e.score,
    }));
    const byWork = new Map(entries.map((e) => [e.work.id, e.id]));
    const links: ConstellationLink[] = [];
    for (const entry of entries) {
      for (const rel of entry.work.relations) {
        const target = byWork.get(rel.workId);
        if (target && target !== entry.id) {
          links.push({ source: entry.id, target, kind: rel.relationType });
        }
      }
    }
    return { nodes, links };
  }, [entries]);
}
