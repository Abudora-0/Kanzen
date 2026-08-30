import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export type SelectOption = { value: string; label: string; hint?: string };

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  className?: string;
};

/**
 * A themed dropdown that unfolds like a sheet of paper. Keyboard accessible,
 * closes on outside click and Escape.
 */
export function Select({ value, options, onChange, label, className }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown') setActive((a) => Math.min(options.length - 1, a + 1));
      if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
      if (e.key === 'Enter') {
        onChange(options[active]!.value);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, active, options, onChange]);

  return (
    <div ref={wrap} className={cn('relative', className)}>
      {label ? (
        <span className="mb-1 block text-[0.7rem] uppercase tracking-[0.18em] text-ink-muted">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center justify-between gap-3 rounded-[10px] border border-hairline bg-surface/70 px-3 py-2 text-sm text-ink transition hover:border-hairline-bright"
      >
        <span>{selected?.label}</span>
        <motion.svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="var(--color-vermillion)" strokeWidth="1.6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            id={id}
            role="listbox"
            initial={{ opacity: 0, y: -6, rotateX: -60 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: -6, rotateX: -40 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top center', transformPerspective: 800 }}
            className="absolute z-40 mt-2 w-full overflow-hidden rounded-[12px] border border-hairline-bright bg-night-2 shadow-[0_24px_60px_-24px_rgba(3,6,20,0.9)]"
          >
            {options.map((opt, i) => (
              <li key={opt.value} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition',
                    i === active ? 'bg-surface-2 text-ink' : 'text-ink-soft',
                  )}
                >
                  <span>{opt.label}</span>
                  {opt.value === value ? (
                    <span className="text-vermillion">•</span>
                  ) : opt.hint ? (
                    <span className="text-[0.7rem] text-ink-faint">{opt.hint}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
