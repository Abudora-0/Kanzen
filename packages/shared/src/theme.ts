/** Accent choices for the Kanzen theme. */
export const ACCENTS = ['rust', 'sage', 'gold'] as const;
export type Accent = (typeof ACCENTS)[number];

const LEGACY_ACCENT: Record<string, Accent> = {
  vermillion: 'rust',
  aurora: 'sage',
  gold: 'gold',
};

/** Maps any stored value (including the pre-Shelf names) to a valid accent. */
export function coerceAccent(value: unknown): Accent {
  if (typeof value === 'string') {
    if ((ACCENTS as readonly string[]).includes(value)) return value as Accent;
    if (value in LEGACY_ACCENT) return LEGACY_ACCENT[value]!;
  }
  return 'rust';
}
