import { z } from 'zod';
import { ENTRY_STATUSES } from './status.js';
import { MEDIA_TYPES } from './media.js';
import { PROVIDER_IDS } from './providers.js';

export const emailSchema = z.string().trim().toLowerCase().email().max(200);
export const passwordSchema = z.string().min(8).max(200);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(60),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const entryUpdateSchema = z
  .object({
    status: z.enum(ENTRY_STATUSES).optional(),
    progress: z.number().int().min(0).max(100_000).optional(),
    score: z.number().min(0).max(10).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const libraryQuerySchema = z.object({
  type: z.enum(MEDIA_TYPES).optional(),
  status: z.enum(ENTRY_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(['updated', 'title', 'score', 'progress']).default('updated'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(40),
});

export const syncRequestSchema = z.object({
  provider: z.enum(PROVIDER_IDS).optional(),
  mode: z.enum(['full', 'incremental']).default('incremental'),
});

export const resolveConflictSchema = z.object({
  workId: z.string().min(1),
  strategy: z.enum(['prefer-local', 'prefer-remote', 'prefer-furthest']),
});

export const settingsSchema = z.object({
  reduceMotion: z.boolean().optional(),
  soundFx: z.boolean().optional(),
  customCursor: z.boolean().optional(),
  accent: z.enum(['rust', 'sage', 'gold']).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EntryUpdateInput = z.infer<typeof entryUpdateSchema>;
export type LibraryQuery = z.infer<typeof libraryQuerySchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
