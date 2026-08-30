import type { PipelineStage } from 'mongoose';
import { Types } from 'mongoose';

type Id = Types.ObjectId;

const lookupWork: PipelineStage[] = [
  { $lookup: { from: 'works', localField: 'workId', foreignField: '_id', as: 'work' } },
  { $unwind: { path: '$work', preserveNullAndEmptyArrays: true } },
];

/**
 * Taste fingerprint. Every entry contributes a weight built from its score,
 * completion, and progress ratio, spread across the work's genres and its top
 * tags. The caller normalises the summed weights onto a 0 to 1 radial axis.
 */
export function tastePipeline(userId: Id): PipelineStage[] {
  return [
    { $match: { userId } },
    ...lookupWork,
    {
      $project: {
        axis: {
          $concatArrays: [
            { $ifNull: ['$work.genres', []] },
            { $slice: [{ $ifNull: ['$work.tags', []] }, 0, 3] },
          ],
        },
        weight: {
          $add: [
            { $divide: [{ $ifNull: ['$score', 0] }, 10] },
            { $cond: [{ $in: ['$status', ['completed', 'repeating']] }, 0.6, 0.15] },
            {
              $min: [
                { $divide: ['$progress', { $max: [{ $ifNull: ['$progressMax', 1] }, 1] }] },
                1,
              ],
            },
          ],
        },
      },
    },
    { $unwind: '$axis' },
    { $group: { _id: '$axis', value: { $sum: '$weight' }, count: { $sum: 1 } } },
    { $match: { count: { $gte: 2 } } },
    { $sort: { value: -1 } },
    { $limit: 12 },
    { $project: { _id: 0, label: '$_id', value: { $round: ['$value', 3] }, count: 1 } },
  ];
}

/**
 * Completion velocity by month with a three month trailing mean via
 * $setWindowFields.
 */
export function velocityPipeline(userId: Id): PipelineStage[] {
  return [
    {
      $match: {
        userId,
        status: { $in: ['completed', 'repeating'] },
        completedAt: { $ne: null },
      },
    },
    {
      $group: {
        _id: { $dateTrunc: { date: '$completedAt', unit: 'month' } },
        completed: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $setWindowFields: {
        sortBy: { _id: 1 },
        output: {
          movingAverage: { $avg: '$completed', window: { documents: [-2, 0] } },
        },
      },
    },
    {
      $project: {
        _id: 0,
        month: { $dateToString: { date: '$_id', format: '%Y-%m' } },
        completed: 1,
        movingAverage: { $round: ['$movingAverage', 2] },
      },
    },
  ];
}

/**
 * One $facet that returns five independent breakdowns of the library in a
 * single pass: status, format, score histogram ($bucket), studios, and release
 * decade ($bucketAuto style via computed key).
 */
export function profileFacetPipeline(userId: Id): PipelineStage[] {
  return [
    { $match: { userId } },
    ...lookupWork,
    {
      $facet: {
        statusBreakdown: [
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $project: { _id: 0, status: '$_id', count: 1 } },
        ],
        formatBreakdown: [
          { $group: { _id: { $ifNull: ['$work.format', 'Unknown'] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
          { $project: { _id: 0, format: '$_id', count: 1 } },
        ],
        scoreHistogram: [
          { $match: { score: { $ne: null, $gt: 0 } } },
          {
            $bucket: {
              groupBy: '$score',
              boundaries: [0, 4, 5, 6, 7, 8, 9, 10.0001],
              default: 'other',
              output: { count: { $sum: 1 } },
            },
          },
          { $project: { _id: 0, from: '$_id', count: 1 } },
        ],
        topStudios: [
          { $unwind: '$work.studios' },
          {
            $group: {
              _id: '$work.studios',
              count: { $sum: 1 },
              meanScore: { $avg: '$score' },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 6 },
          {
            $project: {
              _id: 0,
              studio: '$_id',
              count: 1,
              meanScore: { $round: [{ $ifNull: ['$meanScore', 0] }, 1] },
            },
          },
        ],
        decadeDistribution: [
          { $match: { 'work.year': { $ne: null } } },
          {
            $project: {
              decade: {
                $concat: [
                  {
                    $toString: {
                      $multiply: [{ $floor: { $divide: ['$work.year', 10] } }, 10],
                    },
                  },
                  's',
                ],
              },
            },
          },
          { $group: { _id: '$decade', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, decade: '$_id', count: 1 } },
        ],
      },
    },
  ];
}

/** Totals: entry counts by type, mean score, and watch or read minutes. */
export function totalsPipeline(userId: Id): PipelineStage[] {
  return [
    { $match: { userId } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        meanScore: { $avg: '$score' },
      },
    },
  ];
}

export function minutesPipeline(userId: Id): PipelineStage[] {
  return [{ $match: { userId } }, { $group: { _id: null, minutes: { $sum: '$minutes' } } }];
}

/**
 * Cross platform drift. Only entries flagged with a conflict, joined to the
 * work for a title, with the raw per provider rows so the caller can phrase
 * exactly what disagrees.
 */
export function driftPipeline(userId: Id): PipelineStage[] {
  return [
    { $match: { userId, hasConflict: true } },
    ...lookupWork,
    {
      $project: {
        _id: 0,
        workId: { $toString: '$workId' },
        title: { $ifNull: ['$work.displayTitle', 'Unknown work'] },
        conflictKinds: 1,
        sources: {
          $map: {
            input: '$sources',
            as: 's',
            in: {
              provider: '$$s.provider',
              status: '$$s.status',
              progress: '$$s.progress',
              score: '$$s.score',
            },
          },
        },
      },
    },
    { $limit: 50 },
  ];
}

/** Daily activity for the contribution style heatmap, last 53 weeks. */
export function heatmapPipeline(userId: Id, since: Date): PipelineStage[] {
  return [
    { $match: { userId, at: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { date: '$at', format: '%Y-%m-%d' } },
        count: { $sum: 1 },
        units: { $sum: '$delta' },
      },
    },
    { $project: { _id: 0, date: '$_id', count: 1, units: 1 } },
    { $sort: { date: 1 } },
  ];
}

/**
 * Franchise depth. Starts from every work the user has an entry for that also
 * has relations, then $graphLookup walks the relation edges to assemble the
 * full franchise. Ownership is resolved by the caller against the user's
 * entry set.
 */
export function franchisePipeline(userId: Id): PipelineStage[] {
  return [
    { $match: { userId } },
    ...lookupWork,
    { $match: { 'work.relations.0': { $exists: true } } },
    {
      $graphLookup: {
        from: 'works',
        startWith: '$work._id',
        connectFromField: 'relations.work',
        connectToField: '_id',
        as: 'franchise',
        maxDepth: 6,
      },
    },
    {
      $project: {
        _id: 0,
        rootWorkId: { $toString: '$work._id' },
        title: '$work.displayTitle',
        memberIds: {
          $setUnion: [
            [{ $toString: '$work._id' }],
            { $map: { input: '$franchise', as: 'f', in: { $toString: '$$f._id' } } },
          ],
        },
      },
    },
  ];
}

/** In progress series with the remaining unit count for the finish predictor. */
export function inProgressPipeline(userId: Id): PipelineStage[] {
  return [
    { $match: { userId, status: { $in: ['current', 'repeating'] } } },
    ...lookupWork,
    {
      $project: {
        _id: 0,
        workId: { $toString: '$workId' },
        title: { $ifNull: ['$work.displayTitle', 'Unknown work'] },
        type: '$type',
        progress: '$progress',
        total: {
          $ifNull: [
            '$progressMax',
            { $ifNull: ['$work.episodes', { $ifNull: ['$work.chapters', null] }] },
          ],
        },
      },
    },
    {
      $addFields: {
        remaining: {
          $cond: [
            { $eq: ['$total', null] },
            null,
            { $max: [{ $subtract: ['$total', '$progress'] }, 0] },
          ],
        },
      },
    },
    { $match: { remaining: { $gt: 0 } } },
    { $sort: { remaining: 1 } },
    { $limit: 12 },
  ];
}

/** Units of progress per day over a trailing window, for the finish predictor. */
export function pacePipeline(userId: Id, since: Date): PipelineStage[] {
  return [
    { $match: { userId, at: { $gte: since }, kind: { $in: ['progress', 'completed'] } } },
    {
      $group: {
        _id: '$type',
        units: { $sum: '$delta' },
        days: { $addToSet: { $dateToString: { date: '$at', format: '%Y-%m-%d' } } },
      },
    },
    {
      $project: {
        _id: 0,
        type: '$_id',
        unitsPerDay: {
          $cond: [{ $gt: [{ $size: '$days' }, 0] }, { $divide: ['$units', { $size: '$days' }] }, 0],
        },
      },
    },
  ];
}
