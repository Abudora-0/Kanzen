import { beforeEach, describe, expect, it } from 'vitest';
import { Connection, Entry, SyncRun, User, Work } from '../models/index.js';
import { encryptJson } from '../crypto/tokenCipher.js';
import { runSync } from './engine.js';

async function freshUser() {
  await Promise.all([
    User.deleteMany({}),
    Connection.deleteMany({}),
    Entry.deleteMany({}),
    Work.deleteMany({}),
  ]);
  return User.create({
    email: `t${Date.now()}@kanzen.test`,
    displayName: 'Tester',
    passwordHash: 'x',
  });
}

describe('runSync (demo mode)', () => {
  beforeEach(async () => {
    await Promise.all([Entry.deleteMany({}), Work.deleteMany({}), Connection.deleteMany({})]);
  });

  it('creates entries and canonical works from a demo library', async () => {
    const user = await freshUser();
    const conn = await Connection.create({
      userId: user._id,
      provider: 'anilist',
      encryptedTokens: encryptJson({ accessToken: 'demo' }),
    });

    const stats = await runSync({
      connection: conn,
      mode: 'full',
      syncRunId: '000000000000000000000001',
    });

    expect(stats.fetched).toBeGreaterThan(0);
    expect(stats.created).toBe(stats.fetched);
    expect(await Entry.countDocuments({ userId: user._id })).toBe(stats.created);
    expect(await Work.countDocuments()).toBeGreaterThan(0);
  });

  it('merges a second provider into the same entry and can detect conflicts', async () => {
    const user = await freshUser();
    const anilist = await Connection.create({
      userId: user._id,
      provider: 'anilist',
      encryptedTokens: encryptJson({ accessToken: 'demo' }),
    });
    const mal = await Connection.create({
      userId: user._id,
      provider: 'mal',
      encryptedTokens: encryptJson({ accessToken: 'demo' }),
    });

    await runSync({ connection: anilist, mode: 'full', syncRunId: '000000000000000000000002' });
    const afterFirst = await Entry.countDocuments({ userId: user._id });
    await runSync({ connection: mal, mode: 'full', syncRunId: '000000000000000000000003' });
    const afterSecond = await Entry.countDocuments({ userId: user._id });

    const multiSource = await Entry.find({ userId: user._id, 'sources.1': { $exists: true } });
    expect(multiSource.length).toBeGreaterThan(0);
    expect(afterSecond).toBeGreaterThanOrEqual(afterFirst);

    const withConflict = await Entry.countDocuments({ userId: user._id, hasConflict: true });
    expect(withConflict).toBeGreaterThan(0);
  });

  it('links franchise relations between works', async () => {
    const user = await freshUser();
    const conn = await Connection.create({
      userId: user._id,
      provider: 'anilist',
      encryptedTokens: encryptJson({ accessToken: 'demo' }),
    });
    await runSync({ connection: conn, mode: 'full', syncRunId: '000000000000000000000004' });

    const linked = await Work.countDocuments({ 'relations.0': { $exists: true } });
    expect(linked).toBeGreaterThan(0);
  });

  it('stops cooperatively and marks the run cancelled when cancelRequested is set', async () => {
    const user = await freshUser();
    const conn = await Connection.create({
      userId: user._id,
      provider: 'anilist',
      encryptedTokens: encryptJson({ accessToken: 'demo' }),
    });
    const run = await SyncRun.create({
      userId: user._id,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'full',
      state: 'queued',
    });
    // Set the flag before the loop starts so even a short fixture list, whose
    // one checkpoint lands on the very last entry, is guaranteed to see it.
    await SyncRun.updateOne({ _id: run._id }, { $set: { cancelRequested: true } });

    await runSync({ connection: conn, mode: 'full', syncRunId: String(run._id) });

    const finished = await SyncRun.findById(run._id);
    expect(finished?.state).toBe('cancelled');
    expect(finished?.finishedAt).toBeTruthy();
    const reloadedConn = await Connection.findById(conn._id);
    expect(reloadedConn?.lastSyncedAt).toBeNull();
  });
});
