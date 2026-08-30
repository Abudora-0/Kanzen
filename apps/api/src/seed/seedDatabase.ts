import { CATALOG } from '@kanzen/providers';
import { PROVIDER_IDS } from '@kanzen/shared';
import { env } from '../env.js';
import { logger } from '../logger.js';
import {
  ActivityLog,
  Connection,
  Entry,
  InsightSnapshot,
  SyncRun,
  User,
  Work,
} from '../models/index.js';
import { hashPassword } from '../auth/password.js';
import { encryptJson } from '../crypto/tokenCipher.js';
import { runSync } from '../sync/engine.js';
import { refreshInsightSnapshot } from '../insights/compute.js';

function displayTitle(item: (typeof CATALOG)[number]): string {
  return item.title.english ?? item.title.romaji ?? item.title.native ?? item.key;
}

async function seedCatalogue(): Promise<void> {
  await Work.deleteMany({});
  const byKey = new Map<string, string>();

  for (const item of CATALOG) {
    const work = await Work.create({
      type: item.type,
      title: item.title,
      displayTitle: displayTitle(item),
      synonyms: item.synonyms ?? [],
      format: item.format,
      year: item.year,
      genres: item.genres,
      tags: item.tags,
      studios: item.studios,
      episodes: item.type === 'anime' ? (item.episodes ?? null) : null,
      chapters: item.type === 'manga' ? (item.chapters ?? null) : null,
      runtime: item.type === 'movie' || item.type === 'book' ? (item.runtime ?? null) : null,
      meanScore: item.meanScore,
      externalIds: item.externalIds ?? {},
      source: 'seed',
    });
    byKey.set(item.key, String(work._id));
  }

  for (const item of CATALOG) {
    if (!item.relations?.length) continue;
    const relations = item.relations
      .filter((rel) => byKey.has(rel.key))
      .map((rel) => ({ relationType: rel.relationType, work: byKey.get(rel.key) }));
    await Work.updateOne({ _id: byKey.get(item.key) }, { $set: { relations } });
  }
  logger.info(`seeded ${CATALOG.length} works`);
}

async function seedDemoUser() {
  await User.deleteOne({ email: env.DEMO_EMAIL });
  const user = await User.create({
    email: env.DEMO_EMAIL,
    displayName: 'Kanzen Explorer',
    passwordHash: await hashPassword(env.DEMO_PASSWORD),
    isDemo: true,
    settings: { accent: 'vermillion' },
  });
  logger.info(`demo user ${user.email} ready`);
  return user;
}

export type SeedResult = {
  works: number;
  entries: number;
  conflicts: number;
  franchises: number;
};

/**
 * Reset the demo data: the canonical catalogue, the read only demo account, its
 * four provider connections, a full fixture sync of each, and the insight
 * snapshot. Safe to run repeatedly. Called by the CLI (`pnpm seed`) and by the
 * guarded admin route so a fresh Vercel deploy can be populated with one call.
 */
export async function seedDatabase(): Promise<SeedResult> {
  logger.info('seeding kanzen');

  await Promise.all([
    Entry.deleteMany({}),
    Connection.deleteMany({}),
    SyncRun.deleteMany({}),
    ActivityLog.deleteMany({}),
    InsightSnapshot.deleteMany({}),
  ]);

  await seedCatalogue();
  const user = await seedDemoUser();

  for (const provider of PROVIDER_IDS) {
    const connection = await Connection.create({
      userId: user._id,
      provider,
      handle: `${provider}-demo`,
      encryptedTokens: encryptJson({ accessToken: 'demo' }),
      status: 'active',
    });
    const run = await SyncRun.create({
      userId: user._id,
      connectionId: connection._id,
      provider,
      mode: 'full',
      state: 'queued',
    });
    const stats = await runSync({ connection, mode: 'full', syncRunId: String(run._id) });
    logger.info({ provider, ...stats }, 'synced demo library');
  }

  const payload = await refreshInsightSnapshot(String(user._id));
  return {
    works: CATALOG.length,
    entries: payload.totals.entries,
    conflicts: payload.drift.length,
    franchises: payload.franchises.length,
  };
}
