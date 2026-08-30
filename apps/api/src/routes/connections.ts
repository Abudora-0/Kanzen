import { Router } from 'express';
import { PROVIDERS, PROVIDER_IDS, type ProviderId } from '@kanzen/shared';
import { createPkcePair, createState } from '@kanzen/providers';
import { demoMode, env } from '../env.js';
import { getRedis } from '../redis/redis.js';
import { Connection, Entry, SyncRun, toObjectId } from '../models/index.js';
import { registry } from '../providers/context.js';
import { encryptJson } from '../crypto/tokenCipher.js';
import { requireAuth, blockDemoWrites } from '../auth/middleware.js';
import { asyncHandler, badRequest, notFound } from '../http/errors.js';
import { serializeConnection } from '../dto/serialize.js';
import { enqueueSync } from '../queue/queues.js';
import { logger } from '../logger.js';

export const connectionsRouter: Router = Router();

const STATE_TTL = 600;
const stateKey = (state: string) => `kanzen:oauth:${state}`;

function assertProvider(value: string | undefined): asserts value is ProviderId {
  if (!value || !PROVIDER_IDS.includes(value as ProviderId)) throw notFound('Unknown provider');
}

connectionsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = toObjectId(req.auth!.userId);
    const conns = await Connection.find({ userId }).sort({ createdAt: 1 });
    const counts = await Entry.aggregate<{ _id: string; count: number }>([
      { $match: { userId } },
      { $unwind: '$sources' },
      { $group: { _id: '$sources.provider', count: { $sum: 1 } } },
    ]);
    const byProvider = new Map(counts.map((c) => [c._id, c.count]));

    const known = new Set(conns.map((c) => c.provider));
    const catalogue = PROVIDER_IDS.map((id) => ({
      provider: id,
      meta: PROVIDERS[id],
      connected: known.has(id),
      configured: registry.get(id).isConfigured() || demoMode,
    }));

    res.json({
      connections: conns.map((c) => serializeConnection(c, byProvider.get(c.provider) ?? 0)),
      catalogue,
      demoMode,
    });
  }),
);

connectionsRouter.post(
  '/:provider/connect',
  requireAuth,
  blockDemoWrites,
  asyncHandler(async (req, res) => {
    const { provider } = req.params;
    assertProvider(provider);
    const adapter = registry.get(provider);

    if (demoMode) {
      const conn = await Connection.findOneAndUpdate(
        { userId: req.auth!.userId, provider },
        {
          $set: {
            encryptedTokens: encryptJson({ accessToken: 'demo' }),
            handle: `${PROVIDERS[provider].name.toLowerCase()}-demo`,
            status: 'active',
            error: null,
          },
        },
        { upsert: true, new: true },
      );
      const run = await SyncRun.create({
        userId: req.auth!.userId,
        connectionId: conn._id,
        provider,
        mode: 'full',
        state: 'queued',
      });
      await enqueueSync({
        userId: String(req.auth!.userId),
        connectionId: String(conn._id),
        provider,
        mode: 'full',
        syncRunId: String(run._id),
      }).catch((err) => logger.warn({ err: err.message }, 'sync enqueue failed'));
      return res.status(201).json({ connection: serializeConnection(conn, 0), queued: true });
    }

    if (!adapter.isConfigured()) {
      throw badRequest(
        `${PROVIDERS[provider].name} is not configured on this deployment. Add its credentials or use demo mode.`,
      );
    }

    const state = createState();
    const pkce = createPkcePair();
    const redirectUri = `${env.API_PUBLIC_URL}/api/connections/${provider}/callback`;
    await getRedis().set(
      stateKey(state),
      JSON.stringify({ userId: req.auth!.userId, provider, verifier: pkce.verifier }),
      'EX',
      STATE_TTL,
    );
    const authUrl = await adapter.getAuthUrl({ state, pkce, redirectUri });
    res.json({ authUrl });
  }),
);

connectionsRouter.get(
  '/:provider/callback',
  asyncHandler(async (req, res) => {
    const { provider } = req.params;
    assertProvider(provider);
    const code = String(req.query.code ?? req.query.request_token ?? '');
    const state = String(req.query.state ?? '');
    const web = env.WEB_ORIGIN;

    const rawState = state ? await getRedis().get(stateKey(state)) : null;
    // TMDB does not echo state, so fall back to the most recent pending state.
    const parsed = rawState ? (JSON.parse(rawState) as { userId: string; verifier: string }) : null;
    if (!code || (!parsed && provider !== 'tmdb')) {
      return res.redirect(`${web}/connections?error=oauth_state`);
    }

    try {
      const adapter = registry.get(provider);
      const redirectUri = `${env.API_PUBLIC_URL}/api/connections/${provider}/callback`;
      const { tokens, handle } = await adapter.exchangeCode({
        code,
        verifier: parsed?.verifier ?? '',
        redirectUri,
      });
      const userId = parsed?.userId;
      if (!userId) return res.redirect(`${web}/connections?error=oauth_state`);

      const conn = await Connection.findOneAndUpdate(
        { userId, provider },
        { $set: { encryptedTokens: encryptJson(tokens), handle, status: 'active', error: null } },
        { upsert: true, new: true },
      );
      if (state) await getRedis().del(stateKey(state));

      const run = await SyncRun.create({
        userId,
        connectionId: conn._id,
        provider,
        mode: 'full',
        state: 'queued',
      });
      await enqueueSync({
        userId: String(userId),
        connectionId: String(conn._id),
        provider,
        mode: 'full',
        syncRunId: String(run._id),
      }).catch(() => undefined);

      res.redirect(`${web}/connections?connected=${provider}`);
    } catch (err) {
      logger.warn({ err: (err as Error).message, provider }, 'oauth callback failed');
      res.redirect(`${web}/connections?error=oauth_exchange`);
    }
  }),
);

connectionsRouter.delete(
  '/:provider',
  requireAuth,
  blockDemoWrites,
  asyncHandler(async (req, res) => {
    const { provider } = req.params;
    assertProvider(provider);
    const conn = await Connection.findOneAndDelete({ userId: req.auth!.userId, provider });
    if (!conn) throw notFound('That connection does not exist');
    await Entry.updateMany({ userId: req.auth!.userId }, { $pull: { sources: { provider } } });
    res.json({ ok: true });
  }),
);
