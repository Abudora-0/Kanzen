export * from './media.js';
export * from './status.js';
export * from './providers.js';
export * from './insights.js';
export * from './theme.js';
export * from './schemas.js';
export * from './dto.js';

/** Minutes of runtime assumed per episode when a work has no explicit duration. */
export const DEFAULT_EPISODE_MINUTES = 24;
/** Minutes assumed per manga or book chapter for the hours-read estimate. */
export const DEFAULT_CHAPTER_MINUTES = 6;

export function estimateMinutes(input: {
  type: import('./media.js').MediaType;
  progress: number;
  runtime?: number | null;
  episodeDuration?: number | null;
}): number {
  const { type, progress, runtime, episodeDuration } = input;
  if (type === 'movie') return runtime ?? 110;
  if (type === 'anime') return progress * (episodeDuration ?? DEFAULT_EPISODE_MINUTES);
  return progress * DEFAULT_CHAPTER_MINUTES;
}
