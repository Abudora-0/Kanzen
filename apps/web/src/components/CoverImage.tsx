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

function hueFrom(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

/**
 * A cover poster. Falls back to a deterministic themed placeholder (a torii
 * watermark over a hue derived from the title) when there is no image or it
 * fails to load.
 */
export function CoverImage({ src, alt, type, className, rounded = 'rounded-[10px]' }: Props) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  const hue = hueFrom(alt);

  return (
    <div
      className={cn('relative overflow-hidden bg-surface-2', rounded, className)}
      style={
        !show
          ? {
              background: `linear-gradient(155deg,
                hsl(${hue} 45% 16%),
                hsl(${(hue + 40) % 360} 40% 11%))`,
            }
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
        <div className="absolute inset-0 grid place-items-center">
          <svg viewBox="0 0 64 64" className="h-1/2 w-1/2 opacity-25">
            <g fill="var(--color-ink)">
              <rect x="17.5" y="16" width="5" height="40" rx="1" />
              <rect x="41.5" y="16" width="5" height="40" rx="1" />
              <rect x="31" y="15" width="2" height="10" />
              <path d="M5 15 Q32 8 59 15 L59 10.5 Q32 3.5 5 10.5 Z" />
            </g>
          </svg>
          <span className="absolute bottom-1.5 right-2 font-display text-[0.7rem] text-ink/40">
            {TYPE_GLYPH[type]}
          </span>
        </div>
      )}
    </div>
  );
}
