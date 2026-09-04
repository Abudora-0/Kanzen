import rateLimit from 'express-rate-limit';
import { isTest } from '../env.js';

/** Strict limiter for credential-guessing surfaces: login, register, refresh, and the
 * password-grant connect route. Scoped per route, not global, so normal API use is
 * unaffected. Disabled in tests so the existing suite does not need to pace requests. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'too_many_requests', message: 'Too many attempts, try again later' },
});
