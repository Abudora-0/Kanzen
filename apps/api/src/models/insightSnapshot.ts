import { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { registerModel } from './registerModel.js';

const insightSnapshotSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    generatedAt: { type: Date, default: Date.now },
    /** Serialised InsightsPayload from @kanzen/shared. */
    payload: { type: Schema.Types.Mixed, required: true },
    /** Milliseconds the aggregation run took, shown in the debug panel. */
    computeMs: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type InsightSnapshotDoc = HydratedDocument<InferSchemaType<typeof insightSnapshotSchema>>;
export const InsightSnapshot = registerModel<InferSchemaType<typeof insightSnapshotSchema>>(
  'InsightSnapshot',
  insightSnapshotSchema,
);
