import { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { registerModel } from './registerModel.js';
import { MEDIA_TYPES } from '@kanzen/shared';

const activityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workId: { type: Schema.Types.ObjectId, ref: 'Work', default: null },
    type: { type: String, enum: MEDIA_TYPES, required: true },
    kind: {
      type: String,
      enum: ['progress', 'status', 'started', 'completed', 'score', 'rewatch'],
      required: true,
    },
    /** Units of progress added by this event, when applicable. */
    delta: { type: Number, default: 0 },
    /** Minutes of watch or read time this event represents. */
    minutes: { type: Number, default: 0 },
    at: { type: Date, required: true, default: Date.now },
    source: { type: String, default: 'kanzen' },
  },
  { timestamps: false },
);

activityLogSchema.index({ userId: 1, at: -1 });

export type ActivityLogDoc = HydratedDocument<InferSchemaType<typeof activityLogSchema>>;
export const ActivityLog = registerModel<InferSchemaType<typeof activityLogSchema>>(
  'ActivityLog',
  activityLogSchema,
);
