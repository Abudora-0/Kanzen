import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@kanzen/shared';
import { env } from '../env.js';
import { User, PasswordResetToken } from '../models/index.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { clearAuthCookies, setAuthCookies, verifyRefresh } from '../auth/jwt.js';
import { requireAuth } from '../auth/middleware.js';
import { asyncHandler, badRequest, conflict, unauthorized } from '../http/errors.js';
import { authRateLimit } from '../http/rateLimit.js';
import { serializeUser } from '../dto/serialize.js';
import { sendPasswordResetEmail } from '../email/sendPasswordResetEmail.js';
import { logger } from '../logger.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export const authRouter: Router = Router();

authRouter.post(
  '/register',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const existing = await User.findOne({ email: body.email });
    if (existing) throw conflict('An account with that email already exists');

    const user = await User.create({
      email: body.email,
      displayName: body.displayName,
      passwordHash: await hashPassword(body.password),
    });
    setAuthCookies(res, { sub: String(user._id), isDemo: false });
    res.status(201).json({ user: serializeUser(user) });
  }),
);

authRouter.post(
  '/login',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await User.findOne({ email: body.email });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw unauthorized('Email or password is incorrect');
    }
    user.lastSeenAt = new Date();
    await user.save();
    setAuthCookies(res, {
      sub: String(user._id),
      isDemo: Boolean(user.isDemo),
      remember: body.rememberMe,
    });
    res.json({ user: serializeUser(user) });
  }),
);

authRouter.post(
  '/demo',
  asyncHandler(async (_req, res) => {
    const user = await User.findOne({ email: env.DEMO_EMAIL, isDemo: true });
    if (!user) throw badRequest('Demo account is not seeded. Run pnpm seed.');
    setAuthCookies(res, { sub: String(user._id), isDemo: true });
    res.json({ user: serializeUser(user) });
  }),
);

authRouter.post(
  '/refresh',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.kanzen_refresh;
    if (!token) throw unauthorized('No refresh token');
    try {
      const payload = verifyRefresh(token);
      const user = await User.findById(payload.sub);
      if (!user) throw unauthorized('Account no longer exists');
      setAuthCookies(res, {
        sub: String(user._id),
        isDemo: Boolean(user.isDemo),
        remember: payload.remember,
      });
      res.json({ user: serializeUser(user) });
    } catch {
      clearAuthCookies(res);
      throw unauthorized('Session expired');
    }
  }),
);

// Always responds { ok: true } whether or not the email has an account, so
// the endpoint never reveals which emails are registered.
authRouter.post(
  '/forgot-password',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const body = forgotPasswordSchema.parse(req.body);
    const user = await User.findOne({ email: body.email });
    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash: hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      });
      const resetUrl = `${env.WEB_ORIGIN}/reset-password?token=${rawToken}`;
      sendPasswordResetEmail(user.email, resetUrl).catch((err) =>
        logger.warn({ err: (err as Error).message }, 'password reset email not sent'),
      );
    }
    res.json({ ok: true });
  }),
);

// Returns the same generic message whether the token never existed or has
// simply expired, so neither case leaks more than the other.
authRouter.post(
  '/reset-password',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    const record = await PasswordResetToken.findOne({
      tokenHash: hashResetToken(body.token),
      expiresAt: { $gt: new Date() },
    });
    const user = record ? await User.findById(record.userId) : null;
    if (!record || !user) throw badRequest('That reset link is invalid or has expired');

    user.passwordHash = await hashPassword(body.password);
    await user.save();
    await PasswordResetToken.deleteOne({ _id: record._id });
    clearAuthCookies(res);
    res.json({ ok: true });
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth!.userId);
    if (!user) throw unauthorized('Account no longer exists');
    res.json({ user: serializeUser(user) });
  }),
);
