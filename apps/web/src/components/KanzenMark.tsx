import { useState } from 'react';
import { useMotionPref } from '../lib/store';
import { cn } from '../lib/utils';

type Props = {
  size?: number;
  variant?: 'mark' | 'full';
  syncing?: boolean;
  className?: string;
  replayOnHover?: boolean;
};

/**
 * The Kanzen mark: a vermillion torii gate standing on an aurora ground line.
 * It rises into place on mount, and a light passes through it while a background
 * sync runs. The gate is always drawn complete; the entrance is a single CSS
 * animation whose from-state is still a legible gate, so a dropped frame never
 * leaves it half built.
 */
export function KanzenMark({
  size = 44,
  variant = 'mark',
  syncing = false,
  className,
  replayOnHover = false,
}: Props) {
  const { reduceMotion } = useMotionPref();
  const [replayKey, setReplayKey] = useState(0);

  const mark = (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
      role="img"
      aria-label="Kanzen"
      onMouseEnter={replayOnHover && !reduceMotion ? () => setReplayKey((k) => k + 1) : undefined}
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
        {/* columns */}
        <rect x="17.5" y="16" width="5" height="40" rx="1" fill="var(--color-vermillion)" />
        <rect x="41.5" y="16" width="5" height="40" rx="1" fill="var(--color-vermillion)" />
        {/* nuki: the tie beam through the columns */}
        <rect x="13" y="24" width="38" height="4" rx="1" fill="var(--color-vermillion-deep)" />
        {/* gakuzuka: centre strut */}
        <rect x="31" y="15" width="2" height="10" fill="var(--color-vermillion)" />
        {/* kasagi: the crowning lintel with a shallow upward bow */}
        <path d="M5 15 Q32 8 59 15 L59 10.5 Q32 3.5 5 10.5 Z" fill="var(--color-vermillion)" />
      </g>

      {/* a light passing through the gate while a sync runs */}
      {syncing && !reduceMotion ? (
        <circle r="2.6" fill="var(--color-aurora-violet)">
          <animateMotion dur="1.9s" repeatCount="indefinite" path="M2 20 H62" />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.15;0.85;1"
            dur="1.9s"
            repeatCount="indefinite"
          />
        </circle>
      ) : null}
    </svg>
  );

  if (variant === 'mark') return mark;

  return (
    <span className="inline-flex items-center gap-3">
      {mark}
      <span className="font-display text-[1.4rem] tracking-[0.34em] text-ink">KANZEN</span>
    </span>
  );
}
