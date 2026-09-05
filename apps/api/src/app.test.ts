import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { User, Connection, Entry, SyncRun, Work } from './models/index.js';
import { createApp } from './app.js';
import { env } from './env.js';
import { encryptJson } from './crypto/tokenCipher.js';

let app: Express;

beforeAll(async () => {
  await Promise.all([
    User.deleteMany({}),
    Connection.deleteMany({}),
    Entry.deleteMany({}),
    Work.deleteMany({}),
  ]);
  app = createApp();
});

describe('auth flow', () => {
  const agent = () => request.agent(app);

  it('registers, reads me, and logs out', async () => {
    const client = agent();
    const register = await client
      .post('/api/auth/register')
      .send({ email: 'flow@kanzen.test', password: 'constellation', displayName: 'Flow' });
    expect(register.status).toBe(201);
    expect(register.body.user.email).toBe('flow@kanzen.test');

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.displayName).toBe('Flow');

    const logout = await client.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const after = await client.get('/api/auth/me');
    expect(after.status).toBe(401);
  });

  it('rejects a bad login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'flow@kanzen.test', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('validates the register payload', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'nope' });
    expect(res.status).toBe(422);
  });
});

describe('library', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/library');
    expect(res.status).toBe(401);
  });

  it('lists a seeded library for the demo user', async () => {
    const client = request.agent(app);
    await client
      .post('/api/auth/register')
      .send({ email: 'lib@kanzen.test', password: 'constellation', displayName: 'Lib' });

    // connect a demo provider, which enqueues a sync we run inline here
    const connect = await client.post('/api/connections/anilist/connect');
    expect([200, 201]).toContain(connect.status);

    const { runSync } = await import('./sync/engine.js');
    const conn = await Connection.findOne({ provider: 'anilist' }).sort({ createdAt: -1 });
    await runSync({ connection: conn!, mode: 'full', syncRunId: '00000000000000000000000a' });

    const list = await client.get('/api/library?pageSize=5');
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(list.body.total).toBeGreaterThan(0);
    expect(list.body.items[0].work.displayTitle).toBeTruthy();
  });
});

describe('work cover', () => {
  it('lets a real user contribute a cover, and rejects bad input', async () => {
    const client = request.agent(app);
    await client
      .post('/api/auth/register')
      .send({ email: 'cover@kanzen.test', password: 'constellation', displayName: 'Cover' });
    await client.post('/api/connections/anilist/connect');
    const { runSync } = await import('./sync/engine.js');
    const conn = await Connection.findOne({ provider: 'anilist' }).sort({ createdAt: -1 });
    await runSync({ connection: conn!, mode: 'full', syncRunId: '00000000000000000000000b' });

    const list = await client.get('/api/library?pageSize=1');
    const workId = list.body.items[0].work.id as string;

    const bad = await client.patch(`/api/works/${workId}/cover`).send({ coverImage: 'not-a-url' });
    expect(bad.status).toBe(422);

    const good = await client
      .patch(`/api/works/${workId}/cover`)
      .send({ coverImage: 'https://example.com/cover.jpg' });
    expect(good.status).toBe(200);
    expect(good.body.work.coverImage).toBe('https://example.com/cover.jpg');
  });

  it('blocks the demo account from writing', async () => {
    await User.create({
      email: env.DEMO_EMAIL,
      isDemo: true,
      passwordHash: 'not-checked',
      displayName: 'Demo',
    });
    const client = request.agent(app);
    await client.post('/api/auth/demo');
    const res = await client
      .patch('/api/works/000000000000000000000000/cover')
      .send({ coverImage: 'https://example.com/cover.jpg' });
    expect(res.status).toBe(403);
  });
});

describe('sync cancel', () => {
  it('flags a running sync for cancellation, and leaves a finished one alone', async () => {
    const client = request.agent(app);
    await client
      .post('/api/auth/register')
      .send({ email: 'cancel@kanzen.test', password: 'constellation', displayName: 'Cancel' });
    const me = await client.get('/api/auth/me');
    const conn = await Connection.create({
      userId: me.body.user.id,
      provider: 'anilist',
      encryptedTokens: encryptJson({ accessToken: 'demo' }),
    });
    const running = await SyncRun.create({
      userId: me.body.user.id,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'running',
    });
    const done = await SyncRun.create({
      userId: me.body.user.id,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'done',
    });

    const cancelRunning = await client.post(`/api/sync/${running._id}/cancel`);
    expect(cancelRunning.status).toBe(200);
    expect(cancelRunning.body.run.state).toBe('running');
    expect((await SyncRun.findById(running._id))?.cancelRequested).toBe(true);

    const cancelDone = await client.post(`/api/sync/${done._id}/cancel`);
    expect(cancelDone.status).toBe(200);
    expect((await SyncRun.findById(done._id))?.cancelRequested).toBe(false);
  });

  it('rejects cancelling a run that does not belong to you', async () => {
    const owner = request.agent(app);
    await owner
      .post('/api/auth/register')
      .send({ email: 'owner@kanzen.test', password: 'constellation', displayName: 'Owner' });
    const ownerMe = await owner.get('/api/auth/me');
    const run = await SyncRun.create({
      userId: ownerMe.body.user.id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'running',
    });

    const intruder = request.agent(app);
    await intruder
      .post('/api/auth/register')
      .send({ email: 'intruder@kanzen.test', password: 'constellation', displayName: 'Intruder' });
    const res = await intruder.post(`/api/sync/${run._id}/cancel`);
    expect(res.status).toBe(404);
  });
});

describe('sync history', () => {
  it('clears only terminal-state runs, leaving an in-flight one untouched', async () => {
    const client = request.agent(app);
    await client
      .post('/api/auth/register')
      .send({ email: 'history@kanzen.test', password: 'constellation', displayName: 'History' });
    const me = await client.get('/api/auth/me');
    const conn = await Connection.create({
      userId: me.body.user.id,
      provider: 'anilist',
      encryptedTokens: encryptJson({ accessToken: 'demo' }),
    });
    const running = await SyncRun.create({
      userId: me.body.user.id,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'running',
    });
    const done = await SyncRun.create({
      userId: me.body.user.id,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'done',
    });
    const failed = await SyncRun.create({
      userId: me.body.user.id,
      connectionId: conn._id,
      provider: 'anilist',
      mode: 'incremental',
      state: 'failed',
    });

    const res = await client.delete('/api/sync/runs');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);

    expect(await SyncRun.findById(running._id)).not.toBeNull();
    expect(await SyncRun.findById(done._id)).toBeNull();
    expect(await SyncRun.findById(failed._id)).toBeNull();
  });

  it('blocks the demo account from clearing history', async () => {
    const client = request.agent(app);
    await client.post('/api/auth/demo');
    const res = await client.delete('/api/sync/runs');
    expect(res.status).toBe(403);
  });
});
