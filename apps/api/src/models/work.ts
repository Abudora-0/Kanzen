import { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { registerModel } from './registerModel.js';
import { MEDIA_TYPES } from '@kanzen/shared';

const relationSchema = new Schema(
  {
    relationType: { type: String, required: true },
    work: { type: Schema.Types.ObjectId, ref: 'Work', required: true },
  },
  { _id: false },
);

const workSchema = new Schema(
  {
    type: { type: String, enum: MEDIA_TYPES, required: true, index: true },
    title: {
      romaji: { type: String, default: null },
      english: { type: String, default: null },
      native: { type: String, default: null },
    },
    displayTitle: { type: String, required: true },
    synonyms: { type: [String], default: [] },
    coverImage: { type: String, default: null },
    bannerImage: { type: String, default: null },
    format: { type: String, default: null },
    year: { type: Number, default: null },
    genres: { type: [String], default: [], index: true },
    tags: { type: [String], default: [] },
    studios: { type: [String], default: [] },
    episodes: { type: Number, default: null },
    chapters: { type: Number, default: null },
    runtime: { type: Number, default: null },
    meanScore: { type: Number, default: null },
    externalIds: {
      anilist: { type: Number, default: null },
      mal: { type: Number, default: null },
      kitsu: { type: Number, default: null },
      tmdb: { type: Number, default: null },
      hardcover: { type: Number, default: null },
      imdb: { type: String, default: null },
      isbn: { type: String, default: null },
    },
    relations: { type: [relationSchema], default: [] },
    source: { type: String, default: 'seed' },
  },
  { timestamps: true },
);

workSchema.index({ 'externalIds.anilist': 1 }, { sparse: true });
workSchema.index({ 'externalIds.mal': 1 }, { sparse: true });
workSchema.index({ 'externalIds.tmdb': 1 }, { sparse: true });
workSchema.index({ 'externalIds.isbn': 1 }, { sparse: true });
workSchema.index({ 'externalIds.hardcover': 1 }, { sparse: true });
workSchema.index({ displayTitle: 'text', synonyms: 'text' });

export type WorkDoc = HydratedDocument<InferSchemaType<typeof workSchema>>;
export const Work = registerModel<InferSchemaType<typeof workSchema>>('Work', workSchema);
