import { Schema, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { registerModel } from './registerModel.js';
import { PROVIDER_IDS } from '@kanzen/shared';

const connectionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: PROVIDER_IDS, required: true },
    providerUserId: { type: String, default: null },
    handle: { type: String, default: null },
    scopes: { type: [String], default: [] },
    /** AES-256-GCM encrypted TokenSet, opaque at rest. */
    encryptedTokens: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'error', 'revoked'],
      default: 'active',
    },
    lastSyncedAt: { type: Date, default: null },
    /** Opaque provider pagination cursor for incremental sync. */
    cursor: { type: String, default: null },
    error: { type: String, default: null },
    /** Fixture backed connection, kept working after real OAuth is switched on. */
    demo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

connectionSchema.index({ userId: 1, provider: 1 }, { unique: true });

export type ConnectionDoc = HydratedDocument<InferSchemaType<typeof connectionSchema>>;
export const Connection = registerModel<InferSchemaType<typeof connectionSchema>>(
  'Connection',
  connectionSchema,
);
export const toObjectId = (id: string) => new Types.ObjectId(id);
