import { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { registerModel } from './registerModel.js';
import { PROVIDER_IDS } from '@kanzen/shared';

const syncRunSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    connectionId: { type: Schema.Types.ObjectId, ref: 'Connection', default: null },
    provider: { type: String, enum: PROVIDER_IDS, required: true },
    mode: { type: String, enum: ['full', 'incremental'], default: 'incremental' },
    state: {
      type: String,
      enum: ['queued', 'running', 'done', 'failed'],
      default: 'queued',
    },
    jobId: { type: String, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    stats: {
      fetched: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      conflicts: { type: Number, default: 0 },
    },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

syncRunSchema.index({ userId: 1, createdAt: -1 });

export type SyncRunDoc = HydratedDocument<InferSchemaType<typeof syncRunSchema>>;
export const SyncRun = registerModel<InferSchemaType<typeof syncRunSchema>>(
  'SyncRun',
  syncRunSchema,
);
