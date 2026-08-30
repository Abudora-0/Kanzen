import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

type Tab = { value: string; label: string; count?: number };

type Props = {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  layoutId?: string;
  className?: string;
};

export function Tabs({ tabs, value, onChange, layoutId = 'tab-underline', className }: Props) {
  return (
    <div className={cn('flex gap-1 border-b border-hairline', className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative px-3 py-2 text-sm transition-colors',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink-soft',
            )}
          >
            <span className="font-display tracking-wide">{tab.label}</span>
            {tab.count != null ? (
              <span className="tabular ml-1.5 text-[0.7rem] text-ink-faint">{tab.count}</span>
            ) : null}
            {active ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-vermillion"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
