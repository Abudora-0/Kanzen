import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { env, isProd } from '../env.js';

export type TokenPayload = { sub: string; isDemo: boolean; remember?: boolean };

const ACCESS_TTL = '15m';
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7;
const REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30;

function refreshTtlSeconds(payload: TokenPayload): number {
  return payload.remember ? REMEMBER_TTL_SECONDS : REFRESH_TTL_SECONDS;
}

export function signAccess(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefresh(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: refreshTtlSeconds(payload) });
}

export function verifyAccess(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefresh(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}

const cookieBase = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
};

export function setAuthCookies(res: Response, payload: TokenPayload): void {
  res.cookie('kanzen_access', signAccess(payload), {
    ...cookieBase,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('kanzen_refresh', signRefresh(payload), {
    ...cookieBase,
    maxAge: refreshTtlSeconds(payload) * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('kanzen_access', cookieBase);
  res.clearCookie('kanzen_refresh', cookieBase);
}
