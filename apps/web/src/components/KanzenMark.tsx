import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
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
 * The Kanzen mark: an enso brush stroke, an aurora orbit ring, and a travelling
 * sync node. The orbit turns continuously and speeds up during a sync; the
 * stroke can be replayed on hover. The resting state is always fully drawn so a
 * throttled frame loop never hides the logo.
 */
export function KanzenMark({
  size = 44,
  variant = 'mark',
  syncing = false,
  className,
  replayOnHover = false,
}: Props) {
  const stroke = useRef<SVGPathElement>(null);
  const orbit = useRef<SVGGElement>(null);
  const { reduceMotion } = useMotionPref();

  useEffect(() => {
    const g = orbit.current;
    if (!g || reduceMotion) return;
    const tween = gsap.to(g, {
      rotate: 360,
      duration: syncing ? 2.4 : 10,
      ease: 'none',
      repeat: -1,
      transformOrigin: '50% 50%',
    });
    return () => {
      tween.kill();
      gsap.set(g, { rotate: 0 });
    };
  }, [syncing, reduceMotion]);

  const replay = () => {
    const path = stroke.current;
    if (reduceMotion || !path) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    gsap.fromTo(
      path,
      { strokeDashoffset: length },
      {
        strokeDashoffset: 0,
        duration: 1.1,
        ease: 'power2.inOut',
        onComplete: () => {
          path.style.strokeDasharray = 'none';
        },
      },
    );
  };

  const mark = (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Kanzen"
      onMouseEnter={replayOnHover ? replay : undefined}
    >
      <g ref={orbit} style={{ transformOrigin: '50% 50%' }}>
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke="var(--color-aurora-teal)"
          strokeWidth="1"
          opacity="0.4"
        />
        <circle cx="59" cy="32" r="3" fill="var(--color-aurora-violet)" />
      </g>
      <path
        ref={stroke}
        d="M46 18 A20 20 0 1 1 25 13"
        fill="none"
        stroke="var(--color-vermillion)"
        strokeWidth="6.5"
        strokeLinecap="round"
        style={
          syncing && !reduceMotion
            ? { animation: 'kanzen-breathe 1.6s ease-in-out infinite' }
            : undefined
        }
      />
      <circle cx="32" cy="32" r="3.4" fill="var(--color-ink)" />
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
