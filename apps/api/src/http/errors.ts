import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ProviderError } from '@kanzen/providers';
import { logger } from '../logger.js';
import { isProd } from '../env.js';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new AppError(400, msg, 'bad_request', details);
export const unauthorized = (msg = 'Not authenticated') => new AppError(401, msg, 'unauthorized');
export const forbidden = (msg = 'Not allowed') => new AppError(403, msg, 'forbidden');
export const notFound = (msg = 'Not found') => new AppError(404, msg, 'not_found');
export const conflict = (msg: string) => new AppError(409, msg, 'conflict');

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap an async route so rejected promises reach the error middleware. */
export const asyncHandler =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: 'validation_failed',
      message: 'Request did not match the expected shape',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({ error: err.code, message: err.message, details: err.details });
  }
  if (err instanceof ProviderError) {
    const status = err.code === 'rate_limited' ? 429 : err.code === 'auth' ? 401 : 502;
    return res.status(status).json({ error: `provider_${err.code}`, message: err.message });
  }

  logger.error({ err }, 'unhandled error');
  return res.status(500).json({
    error: 'internal',
    message: isProd ? 'Something went wrong' : String((err as Error)?.message ?? err),
  });
}
