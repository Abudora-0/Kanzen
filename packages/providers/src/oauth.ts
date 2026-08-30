import { createHash, randomBytes } from 'node:crypto';
import type { PkcePair } from './types.js';

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createPkcePair(): PkcePair {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function createState(): string {
  return base64url(randomBytes(24));
}

/** Deterministic hash for cache keys built from a query and variables. */
export function stableHash(input: unknown): string {
  const json = JSON.stringify(input, Object.keys(input as object).sort());
  return createHash('sha1').update(json).digest('hex').slice(0, 16);
}
