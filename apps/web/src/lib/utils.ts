import { clsx, type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export const PROVIDER_COLOR: Record<string, string> = {
  anilist: '#4bb3f7',
  mal: '#8aa4e6',
  kitsu: '#f2542d',
  tmdb: '#5eead4',
  kanzen: '#e2542f',
};

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function titleOf(work: {
  displayTitle: string;
  title: { english?: string; romaji?: string };
}) {
  return work.title.english ?? work.title.romaji ?? work.displayTitle;
}
