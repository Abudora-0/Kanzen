import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { User, Connection, Entry, Work } from './models/index.js';
import { createApp } from './app.js';

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
