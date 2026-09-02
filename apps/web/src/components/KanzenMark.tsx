import { useState } from 'react';
import { useMotionPref } from '../lib/store';
import { cn } from '../lib/utils';

type Props = {
  size?: number;
  variant?: 'mark' | 'full';
  syncing?: boolean;
  className?: string;
  wordmarkClassName?: string;
  replayOnHover?: boolean;
};

/**
 * The Kanzen mark: a vermillion torii gate on an aurora ground line. It rises
 * into place on mount, idles with a faint float, and passes a light through the
 * gate on hover or while a background sync runs. The wordmark reveals letter by
 * letter. The gate is always drawn complete and every from-state is legible, so
 * a dropped frame never leaves the logo half built.
 */
export function KanzenMark({
  size = 44,
  variant = 'mark',
  syncing = false,
  className,
  wordmarkClassName,
  replayOnHover = false,
}: Props) {
  const { reduceMotion } = useMotionPref();
  const [replayKey, setReplayKey] = useState(0);
  const [litKey, setLitKey] = useState(0);
  const lightOn = syncing || litKey > 0;

  const mark = (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
      role="img"
      aria-label="Kanzen"
      onMouseEnter={
        reduceMotion
          ? undefined
          : () => {
              if (replayOnHover) setReplayKey((k) => k + 1);
              setLitKey((k) => k + 1);
            }
      }
    >
      <line
        x1="12"
        y1="56.5"
        x2="52"
        y2="56.5"
        stroke="var(--color-aurora-teal)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />

      <g key={replayKey} className={reduceMotion ? undefined : 'kanzen-gate-rise'}>
        <rect x="17.5" y="16" width="5" height="40" rx="1" fill="var(--color-vermillion)" />
        <rect x="41.5" y="16" width="5" height="40" rx="1" fill="var(--color-vermillion)" />
        <rect x="13" y="24" width="38" height="4" rx="1" fill="var(--color-vermillion-deep)" />
        <rect x="31" y="15" width="2" height="10" fill="var(--color-vermillion)" />
        <path d="M5 15 Q32 8 59 15 L59 10.5 Q32 3.5 5 10.5 Z" fill="var(--color-vermillion)" />
      </g>

      {lightOn && !reduceMotion ? (
        <circle key={`light-${litKey}-${syncing}`} r="2.6" fill="var(--color-aurora-violet)">
          <animateMotion dur="1.9s" repeatCount={syncing ? 'indefinite' : '1'} path="M2 20 H62" />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.15;0.85;1"
            dur="1.9s"
            repeatCount={syncing ? 'indefinite' : '1'}
          />
        </circle>
      ) : null}
    </svg>
  );

  if (variant === 'mark') return mark;

  const letters = 'KANZEN'.split('');
  return (
    <span className="inline-flex items-center gap-2.5">
      {mark}
      <span
        className={cn('wordmark text-[0.95rem] text-ink', wordmarkClassName)}
        aria-hidden="true"
      >
        {reduceMotion
          ? 'KANZEN'
          : letters.map((ch, i) => (
              <span key={`${replayKey}-${i}`} style={{ animationDelay: `${0.15 + i * 0.05}s` }}>
                {ch}
              </span>
            ))}
      </span>
    </span>
  );
}
