import type { SVGProps } from 'react';

// A small hand-picked set of outline icons (24x24, 1.7 stroke) so the app needs
// no icon dependency. Names match the Tabler icons they are drawn after.
const PATHS: Record<string, string> = {
  deck: 'M4 5h16v6H4z M4 15h7v4H4z M14 15h6v4h-6z',
  library: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  insights: 'M4 19V5 M4 19h16 M8 15l3-4 3 2 4-6',
  connections:
    'M10 14a4 4 0 0 1 0-5.6l2-2a4 4 0 0 1 5.6 5.6l-1 1 M14 10a4 4 0 0 1 0 5.6l-2 2a4 4 0 0 1-5.6-5.6l1-1',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H12a2 2 0 1 1 0 4',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  x: 'M18 6 6 18 M6 6l12 12',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off':
    'M10.6 10.6a3 3 0 0 0 4.2 4.2 M17.9 17.9A10.6 10.6 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 5.1-5.9 M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2 M2 2l20 20',
  command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z',
  'arrow-up': 'M12 20V5 M6 11l6-6 6 6',
  plus: 'M12 5v14 M5 12h14',
  'external-link': 'M14 5h5v5 M19 5l-8 8 M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  sun: 'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6l1.4 1.4 M17 17l1.4 1.4 M5.6 18.4l1.4-1.4 M17 7l1.4-1.4 M12 8.5a3.5 3.5 0 1 0 0.01 0',
  moon: 'M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z',
  monitor: 'M4 5h16v11H4z M9 20h6 M12 16v4',
  check: 'M5 12l5 5L20 7',
  'corner-down-right': 'M4 5v6a2 2 0 0 0 2 2h12 M14 9l4 4-4 4',
  film: 'M4 4h16v16H4z M4 8h4 M16 8h4 M4 16h4 M16 16h4 M9 4v16 M15 4v16',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19a2 2 0 0 0 2 2h13',
  spark:
    'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5 18 18 M6 18l2.5-2.5 M15.5 8.5 18 6',
  // Provider marks: simplified, hand-drawn glyphs (not reproductions of the
  // official logos) sized to sit inside a tracker card's colored badge.
  anilist: 'M5 19L12 5L19 19 M8.2 13H15.8',
  mal: 'M4 19V6L12 14L20 6V19',
  kitsu: 'M5 15L4 4L12 11L20 4L19 15L12 20Z',
};

type Props = SVGProps<SVGSVGElement> & { name: keyof typeof PATHS | string; size?: number };

export function Icon({ name, size = 18, className, ...rest }: Props) {
  const d = PATHS[name] ?? PATHS.spark ?? '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {d.split(' M').map((seg, i) => (
        <path key={i} d={(i === 0 ? seg : `M${seg}`).trim()} />
      ))}
    </svg>
  );
}
