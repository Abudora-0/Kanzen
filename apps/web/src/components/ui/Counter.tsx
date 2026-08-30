import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { useMotionPref } from '../../lib/store';
import { cn, formatNumber } from '../../lib/utils';

type Props = {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
  decimals?: number;
};

/**
 * A counter that rolls to its target when scrolled into view, with a failsafe
 * that lands on the value even if the animation frame loop never runs.
 */
export function Counter({ value, duration = 1.4, className, suffix, decimals = 0 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const { reduceMotion } = useMotionPref();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const settle = setTimeout(() => setDisplay(value), duration * 1000 + 600);
    if (!inView) return () => clearTimeout(settle);

    let raf = 0;
    const start = performance.now();
    const from = display;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 5);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [inView, value, reduceMotion, duration]);

  const shown = decimals > 0 ? display.toFixed(decimals) : formatNumber(display);

  return (
    <span ref={ref} className={cn('tabular tracking-tight', className)}>
      {shown}
      {suffix ? <span className="ml-1 text-[0.6em] text-ink-muted">{suffix}</span> : null}
    </span>
  );
}
