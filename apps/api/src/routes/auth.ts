import { Router } from 'express';
import { loginSchema, registerSchema } from '@kanzen/shared';
import { env } from '../env.js';
import { User } from '../models/index.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { clearAuthCookies, setAuthCookies, verifyRefresh } from '../auth/jwt.js';
import { requireAuth } from '../auth/middleware.js';
import { asyncHandler, badRequest, conflict, unauthorized } from '../http/errors.js';
import { serializeUser } from '../dto/serialize.js';

export const authRouter: Router = Router();

authRouter.post(
  '/register',
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
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await User.findOne({ email: body.email });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw unauthorized('Email or password is incorrect');
    }
    user.lastSeenAt = new Date();
    await user.save();
    setAuthCookies(res, { sub: String(user._id), isDemo: Boolean(user.isDemo) });
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
  asyncHandler(async (req, res) => {
    const token = req.cookies?.kanzen_refresh;
    if (!token) throw unauthorized('No refresh token');
    try {
      const payload = verifyRefresh(token);
      const user = await User.findById(payload.sub);
      if (!user) throw unauthorized('Account no longer exists');
      setAuthCookies(res, { sub: String(user._id), isDemo: Boolean(user.isDemo) });
      res.json({ user: serializeUser(user) });
    } catch {
      clearAuthCookies(res);
      throw unauthorized('Session expired');
    }
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
