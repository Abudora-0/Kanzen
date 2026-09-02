import { useState } from 'react';
import type { MediaType } from '@kanzen/shared';
import { cn } from '../lib/utils';

type Props = {
  src?: string | null;
  alt: string;
  type: MediaType;
  className?: string;
  rounded?: string;
};

const TYPE_GLYPH: Record<MediaType, string> = { anime: 'ア', manga: 'マ', book: '本', movie: '映' };
const MEDIA_COLOR: Record<MediaType, string> = {
  anime: 'var(--color-media-anime)',
  manga: 'var(--color-media-manga)',
  book: 'var(--color-media-book)',
  movie: 'var(--color-media-movie)',
};

function hueFrom(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

/**
 * A cover poster. Falls back to a themed placeholder (the theme surface tinted
 * toward a deterministic hue, a stacked-cards watermark, a media-type mark) when
 * there is no image or it fails to load. Adapts to light and dark.
 */
export function CoverImage({ src, alt, type, className, rounded = 'rounded-[12px]' }: Props) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  const hue = hueFrom(alt);

  return (
    <div
      className={cn(
        'relative overflow-hidden border border-hairline bg-surface-2',
        rounded,
        className,
      )}
      style={
        !show
          ? { background: `color-mix(in oklab, hsl(${hue} 55% 50%) 12%, var(--color-surface))` }
          : undefined
      }
    >
      {show ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0">
          <svg
            viewBox="0 0 64 64"
            className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30"
            aria-hidden="true"
          >
            <g fill="none" stroke="var(--color-ink)" strokeWidth="3">
              <rect x="12" y="18" width="20" height="28" rx="4" transform="rotate(-7 22 32)" />
              <rect x="24" y="14" width="20" height="28" rx="4" transform="rotate(-1 34 28)" />
            </g>
            <rect
              x="34"
              y="12"
              width="20"
              height="28"
              rx="4"
              transform="rotate(5 44 26)"
              fill={MEDIA_COLOR[type]}
              opacity="0.55"
            />
          </svg>
          <span
            className="absolute bottom-1.5 right-2 font-display text-[0.7rem]"
            style={{ color: MEDIA_COLOR[type] }}
          >
            {TYPE_GLYPH[type]}
          </span>
        </div>
      )}
    </div>
  );
}
