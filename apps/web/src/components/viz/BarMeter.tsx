import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

type Row = { label: string; value: number; hint?: string };

type Props = {
  rows: Row[];
  accent?: string;
  className?: string;
  formatValue?: (v: number) => string;
};

/** Horizontal bars that grow in on mount, used for status and studio breakdowns. */
export function BarMeter({
  rows,
  accent = 'var(--color-vermillion)',
  className,
  formatValue,
}: Props) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={cn('space-y-2', className)}>
      {rows.map((row, i) => (
        <div
          key={row.label}
          className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm"
        >
          <span className="truncate text-ink-soft" title={row.label}>
            {row.label}
          </span>
          <span className="relative h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: accent,
                width: `${(row.value / max) * 100}%`,
                transformOrigin: 'left',
              }}
              initial={{ scaleX: 0.02 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
          <span className="tabular text-xs text-ink-muted">
            {formatValue ? formatValue(row.value) : row.value}
            {row.hint ? <span className="ml-1 text-ink-faint">{row.hint}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
