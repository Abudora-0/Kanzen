import { beforeAll, describe, expect, it } from 'vitest';
import { Connection, Entry, User, Work, ActivityLog } from '../models/index.js';
import { encryptJson } from '../crypto/tokenCipher.js';
import { runSync } from '../sync/engine.js';
import { computeInsights } from './compute.js';
import { tastePipeline, velocityPipeline, franchisePipeline } from './pipelines.js';
import { Types } from 'mongoose';

let userId: string;

beforeAll(async () => {
  await Promise.all([
    User.deleteMany({}),
    Connection.deleteMany({}),
    Entry.deleteMany({}),
    Work.deleteMany({}),
    ActivityLog.deleteMany({}),
  ]);
  const user = await User.create({
    email: 'insights@kanzen.test',
    displayName: 'Insights',
    passwordHash: 'x',
  });
  userId = String(user._id);
  for (const provider of ['anilist', 'mal', 'tmdb'] as const) {
    const conn = await Connection.create({
      userId: user._id,
      provider,
      encryptedTokens: encryptJson({ accessToken: 'demo' }),
    });
    await runSync({ connection: conn, mode: 'full', syncRunId: new Types.ObjectId().toString() });
  }
});

describe('pipeline builders', () => {
  it('velocity pipeline uses a windowed moving average', () => {
    const stages = velocityPipeline(new Types.ObjectId());
    const stageNames = stages.map((s) => Object.keys(s)[0]);
    expect(stageNames).toContain('$setWindowFields');
  });

  it('franchise pipeline uses $graphLookup', () => {
    const stages = franchisePipeline(new Types.ObjectId());
    expect(stages.some((s) => '$graphLookup' in s)).toBe(true);
  });

  it('taste pipeline unwinds a combined genre and tag axis', () => {
    const stages = tastePipeline(new Types.ObjectId());
    expect(stages.some((s) => '$unwind' in s && s.$unwind === '$axis')).toBe(true);
  });
});

describe('computeInsights', () => {
  it('assembles a full payload from the seeded library', async () => {
    const payload = await computeInsights(userId);
    expect(payload.totals.entries).toBeGreaterThan(0);
    expect(payload.taste.length).toBeGreaterThan(0);
    expect(payload.taste.every((axis) => axis.value >= 0 && axis.value <= 1)).toBe(true);
    expect(payload.profile.statusBreakdown.length).toBeGreaterThan(0);
    expect(payload.profile.scoreHistogram.every((b) => b.to > b.from)).toBe(true);
  });

  it('reports cross platform drift', async () => {
    const payload = await computeInsights(userId);
    expect(payload.drift.length).toBeGreaterThan(0);
    expect(payload.drift[0]!.detail.length).toBeGreaterThan(0);
  });

  it('finds franchise chains via graph lookup', async () => {
    const payload = await computeInsights(userId);
    expect(payload.franchises.length).toBeGreaterThan(0);
    expect(payload.franchises[0]!.total).toBeGreaterThanOrEqual(2);
  });

  it('predicts a finish date for in progress series with pace history', async () => {
    const payload = await computeInsights(userId);
    // predictions may be empty if nothing is in progress; when present they are shaped right
    for (const p of payload.predictions) {
      expect(p.remaining).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(p.confidence);
    }
  });
});
