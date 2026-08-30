import { Types } from 'mongoose';
import type {
  DriftItem,
  FranchiseDepth,
  InsightsPayload,
  MediaType,
  PredictedFinish,
  ProfileFacet,
  ScoreBucket,
  TasteAxis,
} from '@kanzen/shared';
import { MEDIA_TYPES, PROGRESS_UNIT, STATUS_LABEL } from '@kanzen/shared';
import { ActivityLog, Entry, InsightSnapshot } from '../models/index.js';
import { logger } from '../logger.js';
import {
  driftPipeline,
  franchisePipeline,
  heatmapPipeline,
  inProgressPipeline,
  minutesPipeline,
  pacePipeline,
  profileFacetPipeline,
  tastePipeline,
  totalsPipeline,
  velocityPipeline,
} from './pipelines.js';

const SCORE_BOUNDS = [0, 4, 5, 6, 7, 8, 9, 10];

function shapeScoreHistogram(rows: { from: number | string; count: number }[]): ScoreBucket[] {
  return rows
    .filter((r) => typeof r.from === 'number')
    .map((r) => {
      const from = r.from as number;
      const idx = SCORE_BOUNDS.indexOf(from);
      const to = idx >= 0 && idx < SCORE_BOUNDS.length - 1 ? SCORE_BOUNDS[idx + 1]! : 10;
      return { from, to, count: r.count };
    });
}

function phraseDrift(row: {
  workId: string;
  title: string;
  conflictKinds: string[];
  sources: { provider: string; status: string; progress: number; score: number | null }[];
}): DriftItem {
  const kind = (row.conflictKinds[0] ?? 'status') as DriftItem['kind'];
  const providers = row.sources.map((s) => s.provider);
  let detail = '';
  if (kind === 'progress') {
    const sorted = [...row.sources].sort((a, b) => b.progress - a.progress);
    detail = `${sorted[0]!.provider} at ${sorted[0]!.progress}, ${sorted.at(-1)!.provider} at ${sorted.at(-1)!.progress}`;
  } else if (kind === 'score') {
    detail = row.sources
      .filter((s) => s.score != null)
      .map((s) => `${s.provider} ${s.score}`)
      .join(', ');
  } else {
    detail = row.sources
      .map(
        (s) => `${s.provider} ${STATUS_LABEL[s.status as keyof typeof STATUS_LABEL] ?? s.status}`,
      )
      .join(', ');
  }
  return { workId: row.workId, title: row.title, providers, kind, detail };
}

/**
 * Run every insight pipeline for one user and assemble the payload. Pipelines
 * that can share a $facet do; the rest run in parallel.
 */
export async function computeInsights(userIdStr: string): Promise<InsightsPayload> {
  const started = Date.now();
  const userId = new Types.ObjectId(userIdStr);
  const yearAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 371);
  const ninetyAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90);

  const [
    totalsRows,
    minutesRows,
    tasteRows,
    velocityRows,
    profileRows,
    driftRows,
    heatRows,
    franchiseRows,
    inProgressRows,
    paceRows,
    ownedWorkIds,
  ] = await Promise.all([
    Entry.aggregate(totalsPipeline(userId)),
    ActivityLog.aggregate(minutesPipeline(userId)),
    Entry.aggregate(tastePipeline(userId)),
    Entry.aggregate(velocityPipeline(userId)),
    Entry.aggregate(profileFacetPipeline(userId)),
    Entry.aggregate(driftPipeline(userId)),
    ActivityLog.aggregate(heatmapPipeline(userId, yearAgo)),
    Entry.aggregate(franchisePipeline(userId)),
    Entry.aggregate(inProgressPipeline(userId)),
    ActivityLog.aggregate(pacePipeline(userId, ninetyAgo)),
    Entry.find({ userId }).distinct('workId'),
  ]);

  const byType = Object.fromEntries(MEDIA_TYPES.map((t) => [t, 0])) as Record<MediaType, number>;
  let scoreWeightedSum = 0;
  let scoreCount = 0;
  for (const row of totalsRows as { _id: MediaType; count: number; meanScore: number | null }[]) {
    byType[row._id] = row.count;
    if (row.meanScore) {
      scoreWeightedSum += row.meanScore * row.count;
      scoreCount += row.count;
    }
  }
  const entries = Object.values(byType).reduce((a, b) => a + b, 0);
  const minutes = (minutesRows[0]?.minutes as number) ?? 0;

  const maxTaste = Math.max(1, ...(tasteRows as { value: number }[]).map((r) => r.value));
  const taste: TasteAxis[] = (tasteRows as { label: string; value: number; count: number }[]).map(
    (r) => ({
      label: r.label,
      value: Math.round((r.value / maxTaste) * 1000) / 1000,
      count: r.count,
    }),
  );

  const facet = (profileRows[0] ?? {}) as Record<string, unknown[]>;
  const profile: ProfileFacet = {
    statusBreakdown: (facet.statusBreakdown ?? []) as ProfileFacet['statusBreakdown'],
    formatBreakdown: (facet.formatBreakdown ?? []) as ProfileFacet['formatBreakdown'],
    scoreHistogram: shapeScoreHistogram(
      (facet.scoreHistogram ?? []) as { from: number | string; count: number }[],
    ),
    topStudios: (facet.topStudios ?? []) as ProfileFacet['topStudios'],
    decadeDistribution: (facet.decadeDistribution ?? []) as ProfileFacet['decadeDistribution'],
  };

  const owned = new Set((ownedWorkIds as Types.ObjectId[]).map((id) => String(id)));
  const franchiseMap = new Map<string, FranchiseDepth>();
  for (const row of franchiseRows as { rootWorkId: string; title: string; memberIds: string[] }[]) {
    const signature = [...row.memberIds].sort().join('|');
    if (franchiseMap.has(signature)) continue;
    const ownedCount = row.memberIds.filter((id) => owned.has(id)).length;
    if (row.memberIds.length < 2) continue;
    franchiseMap.set(signature, {
      rootWorkId: row.rootWorkId,
      title: row.title,
      owned: ownedCount,
      total: row.memberIds.length,
      streak: ownedCount,
    });
  }
  const franchises = [...franchiseMap.values()]
    .sort((a, b) => b.owned / b.total - a.owned / a.total || b.total - a.total)
    .slice(0, 8);

  const paceByType = new Map<string, number>();
  for (const row of paceRows as { type: string; unitsPerDay: number }[]) {
    paceByType.set(row.type, row.unitsPerDay);
  }
  const predictions: PredictedFinish[] = (
    inProgressRows as { workId: string; title: string; type: MediaType; remaining: number | null }[]
  )
    .filter((r) => r.remaining && r.remaining > 0)
    .map((r) => {
      const perDay = paceByType.get(r.type) ?? 0;
      const days = perDay > 0 ? Math.ceil((r.remaining as number) / perDay) : null;
      const eta =
        days != null && days < 3650
          ? new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
          : null;
      const confidence: PredictedFinish['confidence'] =
        perDay <= 0 ? 'low' : days != null && days < 60 ? 'high' : 'medium';
      return {
        workId: r.workId,
        title: r.title,
        remaining: r.remaining as number,
        unit: PROGRESS_UNIT[r.type],
        eta,
        confidence,
      };
    })
    .slice(0, 10);

  const payload: InsightsPayload = {
    generatedAt: new Date().toISOString(),
    totals: {
      entries,
      byType,
      hoursWatched: Math.round(minutes / 60),
      meanScore: scoreCount ? Math.round((scoreWeightedSum / scoreCount) * 10) / 10 : 0,
    },
    taste,
    velocity: velocityRows as InsightsPayload['velocity'],
    profile,
    drift: (driftRows as Parameters<typeof phraseDrift>[0][]).map(phraseDrift),
    heatmap: (heatRows as { date: string; count: number }[]).map((r) => ({
      date: r.date,
      count: r.count,
    })),
    franchises,
    predictions,
  };

  logger.debug({ ms: Date.now() - started, userId: userIdStr }, 'insights computed');
  return payload;
}

/** Recompute and persist the snapshot. Returns the fresh payload. */
export async function refreshInsightSnapshot(userId: string): Promise<InsightsPayload> {
  const started = Date.now();
  const payload = await computeInsights(userId);
  await InsightSnapshot.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { $set: { payload, generatedAt: new Date(), computeMs: Date.now() - started } },
    { upsert: true },
  );
  return payload;
}
