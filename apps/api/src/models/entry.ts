import { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { registerModel } from './registerModel.js';
import { ENTRY_STATUSES, MEDIA_TYPES, PROVIDER_IDS } from '@kanzen/shared';

const sourceSchema = new Schema(
  {
    provider: { type: String, enum: PROVIDER_IDS, required: true },
    providerEntryId: { type: String, required: true },
    status: { type: String, enum: ENTRY_STATUSES, required: true },
    progress: { type: Number, default: 0 },
    score: { type: Number, default: null },
    syncedAt: { type: Date, default: Date.now },
    /** Local edit not yet pushed back to this provider. */
    dirty: { type: Boolean, default: false },
  },
  { _id: false },
);

const entrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workId: { type: Schema.Types.ObjectId, ref: 'Work', required: true },
    type: { type: String, enum: MEDIA_TYPES, required: true },

    status: { type: String, enum: ENTRY_STATUSES, required: true, default: 'planning' },
    progress: { type: Number, default: 0 },
    progressMax: { type: Number, default: null },
    score: { type: Number, default: null },
    repeats: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    favorite: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    sources: { type: [sourceSchema], default: [] },
    hasConflict: { type: Boolean, default: false },
    conflictKinds: { type: [String], default: [] },
  },
  { timestamps: true },
);

entrySchema.index({ userId: 1, workId: 1 }, { unique: true });
entrySchema.index({ userId: 1, type: 1, status: 1 });
entrySchema.index({ userId: 1, updatedAt: -1 });
entrySchema.index({ userId: 1, hasConflict: 1 });

export type EntryDoc = HydratedDocument<InferSchemaType<typeof entrySchema>>;
export const Entry = registerModel<InferSchemaType<typeof entrySchema>>('Entry', entrySchema);
