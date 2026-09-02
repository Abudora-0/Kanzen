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
 * The Kanzen mark: three cards fanned into a stack, the front one rust. Many
 * trackers merged into one. The stack shelves in on mount and a rust bar runs
 * along its base while a sync is live. The mark is always drawn complete and
 * every from-state is legible, so a dropped frame never leaves it broken.
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

  const card = reduceMotion ? undefined : 'kanzen-card';

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
      <g key={replayKey}>
        <g className={card ? `${card} kanzen-card-1` : undefined}>
          <rect
            x="12"
            y="19"
            width="29"
            height="29"
            rx="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.4"
            transform="rotate(-9 26.5 33.5)"
          />
        </g>
        <g className={card ? `${card} kanzen-card-2` : undefined}>
          <rect
            x="16"
            y="16"
            width="29"
            height="29"
            rx="7"
            fill="none"
            stroke="var(--color-sage)"
            strokeWidth="3.4"
            transform="rotate(-3 30.5 30.5)"
          />
        </g>
        <g className={card ? `${card} kanzen-card-3` : undefined}>
          <rect x="20" y="13" width="29" height="29" rx="7" fill="var(--color-vermillion)" />
        </g>
      </g>

      <rect
        x="14"
        y="54"
        width="36"
        height="3"
        rx="1.5"
        fill="var(--color-vermillion)"
        opacity="0.22"
      />
      {lightOn && !reduceMotion ? (
        <rect
          key={`lit-${litKey}-${syncing}`}
          x="14"
          y="54"
          height="3"
          rx="1.5"
          fill="var(--color-vermillion)"
        >
          <animate
            attributeName="width"
            values="0;36;36;0"
            keyTimes="0;0.4;0.6;1"
            dur="1.8s"
            repeatCount={syncing ? 'indefinite' : '1'}
          />
        </rect>
      ) : null}
    </svg>
  );

  if (variant === 'mark') return mark;

  const letters = 'Kanzen'.split('');
  return (
    <span className="inline-flex items-center gap-2.5">
      {mark}
      <span
        className={cn('wordmark text-[1.05rem] text-ink', wordmarkClassName)}
        aria-hidden="true"
      >
        {reduceMotion
          ? 'Kanzen'
          : letters.map((ch, i) => (
              <span key={`${replayKey}-${i}`} style={{ animationDelay: `${0.12 + i * 0.045}s` }}>
                {ch}
              </span>
            ))}
      </span>
    </span>
  );
}
