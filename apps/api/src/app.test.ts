import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { User, Connection, Entry, SyncRun, Work, PasswordResetToken } from './models/index.js';
import { createApp } from './app.js';
import { env } from './env.js';
import { encryptJson } from './crypto/tokenCipher.js';

let app: Express;

/** supertest types Set-Cookie as string | undefined even though it is always
 * an array in practice; narrow it once here instead of at every call site. */
function findCookie(headers: Record<string, unknown>, name: string): string | undefined {
  const raw = headers['set-cookie'] as string[] | undefined;
  return raw?.find((c) => c.startsWith(name));
}

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

  it('extends the refresh cookie lifetime for remember me, and keeps it long across a refresh', async () => {
    const client = agent();
    await client.post('/api/auth/register').send({
      email: 'remember@kanzen.test',
      password: 'constellation',
      displayName: 'Remember',
    });
    await client.post('/api/auth/logout');

    const login = await client.post('/api/auth/login').send({
      email: 'remember@kanzen.test',
      password: 'constellation',
      rememberMe: true,
    });
    expect(login.status).toBe(200);
    const loginCookie = findCookie(login.headers, 'kanzen_refresh');
    const loginMaxAge = Number(/Max-Age=(\d+)/.exec(loginCookie ?? '')?.[1]);
    expect(loginMaxAge).toBeGreaterThan(60 * 60 * 24 * 8); // well past the 7-day default

    const refresh = await client.post('/api/auth/refresh');
    expect(refresh.status).toBe(200);
    const refreshCookie = findCookie(refresh.headers, 'kanzen_refresh');
    const refreshMaxAge = Number(/Max-Age=(\d+)/.exec(refreshCookie ?? '')?.[1]);
    expect(refreshMaxAge).toBeGreaterThan(60 * 60 * 24 * 8);
  });

  it('creates a hashed reset token for a real email, and nothing for an unknown one', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'forgot@kanzen.test',
      password: 'constellation',
      displayName: 'Forgot',
    });

    const known = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'forgot@kanzen.test' });
    expect(known.status).toBe(200);
    expect(known.body.ok).toBe(true);
    const user = await User.findOne({ email: 'forgot@kanzen.test' });
    const token = await PasswordResetToken.findOne({ userId: user!._id });
    expect(token).not.toBeNull();
    expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody-here@kanzen.test' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.ok).toBe(true);
    expect(await PasswordResetToken.countDocuments({})).toBe(1);
  });

  it('resets the password with a valid token, and rejects reuse or an expired one', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'resetme@kanzen.test',
      password: 'constellation',
      displayName: 'Reset',
    });
    const user = await User.findOne({ email: 'resetme@kanzen.test' });

    const rawToken = 'a'.repeat(64);
    const { createHash } = await import('node:crypto');
    await PasswordResetToken.create({
      userId: user!._id,
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const badToken = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', password: 'brandnewpass' });
    expect(badToken.status).toBe(400);

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'brandnewpass' });
    expect(reset.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'resetme@kanzen.test', password: 'brandnewpass' });
    expect(login.status).toBe(200);

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'anotherpass' });
    expect(reuse.status).toBe(400);

    const expiredRawToken = 'b'.repeat(64);
    await PasswordResetToken.create({
      userId: user!._id,
      tokenHash: createHash('sha256').update(expiredRawToken).digest('hex'),
      expiresAt: new Date(Date.now() - 1000),
    });
    const expired = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: expiredRawToken, password: 'yetanotherpass' });
    expect(expired.status).toBe(400);
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
