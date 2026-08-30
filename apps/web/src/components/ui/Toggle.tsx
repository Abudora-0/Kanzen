import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
};

export function Toggle({ checked, onChange, label, description }: Props) {
  return (
    <label className="flex items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {description ? (
          <span className="block text-[0.8rem] text-ink-muted">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors',
          checked ? 'border-vermillion bg-vermillion/25' : 'border-hairline bg-surface',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={cn(
            'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full',
            checked ? 'right-1 bg-vermillion' : 'left-1 bg-ink-faint',
          )}
        />
      </button>
    </label>
  );
}
