import { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { registerModel } from './registerModel.js';

const settingsSchema = new Schema(
  {
    reduceMotion: { type: Boolean, default: false },
    soundFx: { type: Boolean, default: false },
    customCursor: { type: Boolean, default: false },
    accent: { type: String, enum: ['vermillion', 'aurora', 'gold'], default: 'vermillion' },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    isDemo: { type: Boolean, default: false },
    settings: { type: settingsSchema, default: () => ({}) },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = registerModel<InferSchemaType<typeof userSchema>>('User', userSchema);
