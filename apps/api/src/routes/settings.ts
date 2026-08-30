import { Router } from 'express';
import { settingsSchema } from '@kanzen/shared';
import { User } from '../models/index.js';
import { requireAuth, blockDemoWrites } from '../auth/middleware.js';
import { asyncHandler, notFound } from '../http/errors.js';
import { serializeUser } from '../dto/serialize.js';

export const settingsRouter: Router = Router();

settingsRouter.patch(
  '/',
  requireAuth,
  blockDemoWrites,
  asyncHandler(async (req, res) => {
    const patch = settingsSchema.parse(req.body);
    const user = await User.findById(req.auth!.userId);
    if (!user) throw notFound('Account not found');
    user.settings = {
      reduceMotion: patch.reduceMotion ?? user.settings?.reduceMotion ?? false,
      soundFx: patch.soundFx ?? user.settings?.soundFx ?? false,
      customCursor: patch.customCursor ?? user.settings?.customCursor ?? false,
      accent: patch.accent ?? user.settings?.accent ?? 'vermillion',
    };
    await user.save();
    res.json({ user: serializeUser(user) });
  }),
);
