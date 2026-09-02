import { useRef } from 'react';
import { cn } from '../../lib/utils';

type Props = {
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
  unit?: string;
  className?: string;
};

/**
 * Progress logging slider. The filled track is vermillion, the thumb carries a
 * value bubble, and small ticks mark the range like a star chart scale.
 */
export function Slider({ value, min = 0, max, step = 1, onChange, label, unit, className }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const ticks = Math.min(20, Math.max(4, Math.round((max - min) / step)));

  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-ink-muted">{label}</span>
          <span className="tabular text-sm text-ink">
            {value}
            {unit ? <span className="text-ink-muted"> / {max}</span> : null}
          </span>
        </div>
      ) : null}
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-2" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{
            width: `${pct}%`,
            background:
              'linear-gradient(90deg, var(--color-vermillion-deep), var(--color-vermillion))',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-0.5">
          {Array.from({ length: ticks + 1 }, (_, i) => (
            <span key={i} className="h-2 w-px bg-hairline" />
          ))}
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-vermillion shadow-card"
          style={{ left: `${pct}%` }}
        />
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label ?? 'value'}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
