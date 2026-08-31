import { createProviderRegistry, type SyncContext, type TokenSet } from '@kanzen/providers';
import { demoMode, providerConfig } from '../env.js';
import { logger } from '../logger.js';
import { decryptJson, encryptJson } from '../crypto/tokenCipher.js';
import type { ConnectionDoc } from '../models/index.js';

export const registry = createProviderRegistry(providerConfig);

export function decryptTokens(connection: ConnectionDoc): TokenSet {
  return decryptJson<TokenSet>(connection.encryptedTokens);
}

export async function persistTokens(connection: ConnectionDoc, tokens: TokenSet): Promise<void> {
  connection.encryptedTokens = encryptJson(tokens);
  connection.status = 'active';
  connection.error = null;
  await connection.save();
}

export function buildSyncContext(
  connection: ConnectionDoc,
  opts: { mode: 'full' | 'incremental' },
): SyncContext {
  const since =
    opts.mode === 'incremental' && connection.lastSyncedAt
      ? new Date(connection.lastSyncedAt.getTime() - 1000 * 60 * 60 * 24)
      : null;

  // A connection can be demo even when the deployment is not: the seeded demo
  // account keeps working on fixtures after real OAuth is switched on.
  const isDemo = demoMode || Boolean(connection.get('demo'));

  return {
    userId: String(connection.userId),
    connectionId: String(connection._id),
    handle: connection.handle,
    tokens: isDemo ? { accessToken: 'demo' } : decryptTokens(connection),
    since,
    demo: isDemo,
    log: (message, meta) => logger.debug({ provider: connection.provider, ...meta }, message),
  };
}
