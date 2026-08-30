import type { EntryStatus } from './status.js';
import type { MediaType } from './media.js';

export type TasteAxis = {
  label: string;
  /** 0 to 1, normalised affinity weighted by score and progress. */
  value: number;
  count: number;
};

export type VelocityPoint = {
  /** ISO month, e.g. 2026-03. */
  month: string;
  completed: number;
  /** Three month trailing mean. */
  movingAverage: number;
};

export type ScoreBucket = { from: number; to: number; count: number };

export type ProfileFacet = {
  statusBreakdown: { status: EntryStatus; count: number }[];
  formatBreakdown: { format: string; count: number }[];
  scoreHistogram: ScoreBucket[];
  topStudios: { studio: string; count: number; meanScore: number }[];
  decadeDistribution: { decade: string; count: number }[];
};

export type DriftItem = {
  workId: string;
  title: string;
  /** The two or more providers that disagree. */
  providers: string[];
  kind: 'status' | 'progress' | 'score';
  detail: string;
};

export type HeatCell = { date: string; count: number };

export type FranchiseDepth = {
  rootWorkId: string;
  title: string;
  owned: number;
  total: number;
  /** Longest consecutive chain the user has completed. */
  streak: number;
};

export type PredictedFinish = {
  workId: string;
  title: string;
  remaining: number;
  unit: string;
  /** ISO date, null when there is not enough history to predict. */
  eta: string | null;
  confidence: 'low' | 'medium' | 'high';
};

export type InsightsPayload = {
  generatedAt: string;
  totals: {
    entries: number;
    byType: Record<MediaType, number>;
    hoursWatched: number;
    meanScore: number;
  };
  taste: TasteAxis[];
  velocity: VelocityPoint[];
  profile: ProfileFacet;
  drift: DriftItem[];
  heatmap: HeatCell[];
  franchises: FranchiseDepth[];
  predictions: PredictedFinish[];
};
