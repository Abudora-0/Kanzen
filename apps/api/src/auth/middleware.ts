import type { NextFunction, Request, Response } from 'express';
import { AppError, unauthorized } from '../http/errors.js';
import { verifyAccess } from './jwt.js';

/** Require a valid access token cookie (or Bearer header). Sets req.auth. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = req.cookies?.kanzen_access ?? bearer;
  if (!token) return next(unauthorized());
  try {
    const payload = verifyAccess(token);
    req.auth = { userId: payload.sub, isDemo: payload.isDemo };
    next();
  } catch {
    next(unauthorized('Session expired'));
  }
}

/** Populate req.auth when a token is present but never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.kanzen_access;
  if (token) {
    try {
      const payload = verifyAccess(token);
      req.auth = { userId: payload.sub, isDemo: payload.isDemo };
    } catch {
      /* ignore */
    }
  }
  next();
}

/** Block writes performed by the shared demo account. */
export function blockDemoWrites(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.isDemo) {
    return next(
      new AppError(
        403,
        'The demo account is read only. Create an account to make changes.',
        'demo_read_only',
      ),
    );
  }
  next();
}
