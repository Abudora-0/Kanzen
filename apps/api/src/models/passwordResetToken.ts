import { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { registerModel } from './registerModel.js';

const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// TTL index: Mongo drops the document itself once expiresAt passes, so an
// unused token cannot outlive its stated lifetime even if nothing reads it.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetTokenDoc = HydratedDocument<
  InferSchemaType<typeof passwordResetTokenSchema>
>;
export const PasswordResetToken = registerModel<InferSchemaType<typeof passwordResetTokenSchema>>(
  'PasswordResetToken',
  passwordResetTokenSchema,
);
