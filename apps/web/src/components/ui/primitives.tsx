import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function Panel({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('glass p-5', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  eyebrow,
  className,
}: {
  children: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-4', className)}>
      {eyebrow ? (
        <p className="mb-1 text-[0.7rem] uppercase tracking-[0.24em] text-vermillion">{eyebrow}</p>
      ) : null}
      <h2 className="font-display text-lg text-ink">{children}</h2>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet';
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'ghost', loading, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-vermillion text-white shadow-[0_10px_30px_-10px_rgba(226,84,47,0.7)] hover:bg-vermillion-bright',
        variant === 'ghost' &&
          'border border-hairline-bright bg-surface/60 text-ink hover:border-vermillion hover:text-ink',
        variant === 'quiet' && 'text-ink-muted hover:text-ink',
        className,
      )}
      disabled={disabled || loading}
      {...(rest as object)}
    >
      {loading ? <span className="km-spinner h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </motion.button>
  );
});

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'teal' | 'violet' | 'warn';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] tracking-wide',
        tone === 'neutral' && 'border-hairline text-ink-muted',
        tone === 'accent' && 'border-vermillion/40 bg-vermillion/10 text-vermillion-bright',
        tone === 'teal' && 'border-aurora-teal/40 bg-aurora-teal/10 text-aurora-teal',
        tone === 'violet' && 'border-aurora-violet/40 bg-aurora-violet/10 text-aurora-violet',
        tone === 'warn' && 'border-gold/40 bg-gold/10 text-gold',
        className,
      )}
    >
      {children}
    </span>
  );
}
