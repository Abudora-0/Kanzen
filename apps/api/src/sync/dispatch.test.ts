import { describe, expect, it } from 'vitest';
import { Connection, SyncRun, User } from '../models/index.js';
import { encryptJson } from '../crypto/tokenCipher.js';
import { dispatchSync, reapStaleSyncRuns } from './dispatch.js';

async function freshConnection() {
  await Promise.all([User.deleteMany({}), Connection.deleteMany({}), SyncRun.deleteMany({})]);
  const user = await User.create({
    email: `t${Date.now()}@kanzen.test`,
    displayName: 'Tester',
    passwordHash: 'x',
  });
  const conn = await Connection.create({
    userId: user._id,
    provider: 'anilist',
    encryptedTokens: encryptJson({ accessToken: 'demo' }),
  });
  return { user, conn };
}

/** Back-dates a run's updatedAt without triggering Mongoose's own timestamp. */
async function backdate(runId: unknown, msAgo: number) {
  await SyncRun.updateOne(
    { _id: runId },
    { $set: { updatedAt: new Date(Date.now() - msAgo) } },
    { timestamps: false },
  );
}

describe('dispatchSync', () => {
  it('reuses an active run for the same connection instead of starting a duplicate', async () => {
    const { conn } = await freshConnection();
    const stuck = await SyncRun.create({
      userId: conn.userId,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'running',
    });
    await backdate(stuck._id, 5_000); // well inside the not-stale window

    const result = await dispatchSync({ connection: conn, mode: 'incremental' });

    expect(String(result._id)).toBe(String(stuck._id));
    expect(await SyncRun.countDocuments({ connectionId: conn._id })).toBe(1);
  });

  it('reaps a run stuck past the serverless time limit and starts a fresh one', async () => {
    const { conn } = await freshConnection();
    const killed = await SyncRun.create({
      userId: conn.userId,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'running',
    });
    await backdate(killed._id, 400_000); // past the stale threshold

    const result = await dispatchSync({ connection: conn, mode: 'incremental' });

    const reaped = await SyncRun.findById(killed._id);
    expect(reaped?.state).toBe('failed');
    expect(reaped?.error).toMatch(/timed out/i);
    expect(String(result._id)).not.toBe(String(killed._id));
  });
});

describe('reapStaleSyncRuns', () => {
  it('only reaps runs older than the stale threshold', async () => {
    const { conn } = await freshConnection();
    const fresh = await SyncRun.create({
      userId: conn.userId,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'running',
    });
    const stale = await SyncRun.create({
      userId: conn.userId,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'queued',
    });
    await backdate(stale._id, 400_000);

    await reapStaleSyncRuns({ userId: conn.userId });

    expect((await SyncRun.findById(fresh._id))?.state).toBe('running');
    expect((await SyncRun.findById(stale._id))?.state).toBe('failed');
  });

  it('never reaps a worker-dispatched run, however stale, since it has no external kill', async () => {
    const { conn } = await freshConnection();
    const workerRun = await SyncRun.create({
      userId: conn.userId,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'running',
      jobId: 'sync:some-run-id',
    });
    await backdate(workerRun._id, 10_000_000);

    await reapStaleSyncRuns({ userId: conn.userId });

    expect((await SyncRun.findById(workerRun._id))?.state).toBe('running');
  });
});
