import { Router } from 'express';
import { workCoverSchema } from '@kanzen/shared';
import { Work } from '../models/index.js';
import { requireAuth, blockDemoWrites } from '../auth/middleware.js';
import { asyncHandler, notFound } from '../http/errors.js';
import { serializeWork } from '../dto/serialize.js';
import { sharedWriteRateLimit } from '../http/rateLimit.js';

export const worksRouter: Router = Router();

// Works are the shared, canonical catalogue entry behind every user's
// tracked entry, so a submitted cover fills it in for everyone, not just the
// submitter. Useful for the seeded titles that never got real art.
worksRouter.patch(
  '/:id/cover',
  requireAuth,
  blockDemoWrites,
  sharedWriteRateLimit,
  asyncHandler(async (req, res) => {
    const { coverImage } = workCoverSchema.parse(req.body);
    const work = await Work.findById(req.params.id);
    if (!work) throw notFound('Work not found');
    work.coverImage = coverImage;
    await work.save();
    res.json({ work: serializeWork(work) });
  }),
);
