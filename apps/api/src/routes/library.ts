import { Router } from 'express';
import type { PipelineStage } from 'mongoose';
import { libraryQuerySchema } from '@kanzen/shared';
import { Entry, Work, toObjectId } from '../models/index.js';
import { requireAuth } from '../auth/middleware.js';
import { asyncHandler, notFound } from '../http/errors.js';
import { serializeEntry, serializeWork } from '../dto/serialize.js';
import { cached } from '../cache/cache.js';

export const libraryRouter: Router = Router();

const SORT_FIELDS: Record<string, Record<string, 1 | -1>> = {
  updated: { updatedAt: -1 },
  title: { 'work.displayTitle': 1 },
  score: { score: -1, updatedAt: -1 },
  progress: { progress: -1 },
};

libraryRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = libraryQuerySchema.parse(req.query);
    const userId = toObjectId(req.auth!.userId);

    const match: Record<string, unknown> = { userId };
    if (q.type) match.type = q.type;
    if (q.status) match.status = q.status;

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $lookup: { from: 'works', localField: 'workId', foreignField: '_id', as: 'work' } },
      { $unwind: '$work' },
    ];
    if (q.q) {
      const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      pipeline.push({
        $match: {
          $or: [{ 'work.displayTitle': rx }, { 'work.synonyms': rx }, { 'work.title.native': rx }],
        },
      });
    }
    pipeline.push({
      $facet: {
        rows: [
          { $sort: SORT_FIELDS[q.sort] ?? SORT_FIELDS.updated! },
          { $skip: (q.page - 1) * q.pageSize },
          { $limit: q.pageSize },
        ],
        total: [{ $count: 'value' }],
      },
    });

    const [result] = await Entry.aggregate(pipeline);
    const rows = (result?.rows ?? []) as Record<string, unknown>[];
    const total = (result?.total?.[0]?.value as number) ?? 0;

    const items = rows.map((row) => {
      const { work, ...entryRow } = row;
      return serializeEntry(Entry.hydrate(entryRow), Work.hydrate(work));
    });

    res.json({ items, page: q.page, pageSize: q.pageSize, total });
  }),
);

libraryRouter.get(
  '/graph',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = toObjectId(req.auth!.userId);
    const match: Record<string, unknown> = { userId };
    if (typeof req.query.type === 'string' && req.query.type) match.type = req.query.type;
    if (typeof req.query.status === 'string' && req.query.status) match.status = req.query.status;

    const rows = await Entry.aggregate<{
      _id: unknown;
      workId: unknown;
      status: string;
      progress: number;
      score: number | null;
      title: string;
      type: string;
      relations: { work: unknown }[];
    }>([
      { $match: match },
      { $lookup: { from: 'works', localField: 'workId', foreignField: '_id', as: 'work' } },
      { $unwind: '$work' },
      {
        $project: {
          workId: 1,
          status: 1,
          progress: 1,
          score: 1,
          type: 1,
          title: '$work.displayTitle',
          relations: '$work.relations',
        },
      },
    ]);

    const idByWork = new Map(rows.map((r) => [String(r.workId), String(r._id)]));
    const nodes = rows.map((r) => ({
      id: String(r._id),
      title: r.title,
      type: r.type,
      status: r.status,
      progress: r.progress,
      score: r.score ?? null,
    }));
    const links: { source: string; target: string; kind: string }[] = [];
    for (const row of rows) {
      for (const rel of row.relations ?? []) {
        const target = idByWork.get(String(rel.work));
        if (target && target !== String(row._id)) {
          links.push({ source: String(row._id), target, kind: 'relation' });
        }
      }
    }
    res.json({ nodes, links });
  }),
);

libraryRouter.get(
  '/stats',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = toObjectId(req.auth!.userId);
    const data = await cached(`user:${req.auth!.userId}:library-stats`, { ttl: 60, swr: 120 }, () =>
      Entry.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            conflicts: { $sum: { $cond: ['$hasConflict', 1, 0] } },
            byStatus: { $push: '$status' },
            byType: { $push: '$type' },
          },
        },
      ]),
    );
    const row = data[0] ?? { total: 0, conflicts: 0, byStatus: [], byType: [] };
    const tally = (arr: string[]) =>
      arr.reduce<Record<string, number>>((acc, k) => ((acc[k] = (acc[k] ?? 0) + 1), acc), {});
    res.json({
      total: row.total,
      conflicts: row.conflicts,
      byStatus: tally(row.byStatus),
      byType: tally(row.byType),
    });
  }),
);

libraryRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const entry = await Entry.findOne({ _id: req.params.id, userId: req.auth!.userId });
    if (!entry) throw notFound('Entry not found');
    const work = await Work.findById(entry.workId).populate('relations.work', 'displayTitle');
    if (!work) throw notFound('Work not found');

    const related = await Entry.find({
      userId: req.auth!.userId,
      workId: { $in: (work.relations ?? []).map((r) => r.work) },
    }).select('workId status progress');

    res.json({
      entry: serializeEntry(entry, work),
      work: serializeWork(work),
      relatedProgress: related.map((r) => ({
        workId: String(r.workId),
        status: r.status,
        progress: r.progress,
      })),
    });
  }),
);
