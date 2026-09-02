import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

type Props = {
  title: string;
  body?: string;
  action?: { label: string; to?: string; onClick?: () => void };
  className?: string;
};

export function EmptyState({ title, body, action, className }: Props) {
  return (
    <div className={cn('glass flex flex-col items-center px-6 py-14 text-center', className)}>
      <svg viewBox="0 0 64 64" className="mb-4 h-14 w-14 opacity-45" aria-hidden="true">
        <line
          x1="10"
          y1="50"
          x2="54"
          y2="50"
          stroke="var(--color-sage)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <g fill="none" stroke="var(--color-ink)" strokeWidth="2.4">
          <rect x="14" y="16" width="20" height="30" rx="4" transform="rotate(-7 24 31)" />
          <rect x="24" y="13" width="20" height="30" rx="4" transform="rotate(-1 34 28)" />
        </g>
        <rect
          x="34"
          y="12"
          width="20"
          height="30"
          rx="4"
          transform="rotate(5 44 27)"
          fill="var(--color-vermillion)"
          opacity="0.3"
        />
      </svg>
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {body ? <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{body}</p> : null}
      {action ? (
        action.to ? (
          <Link
            to={action.to}
            className="mt-5 rounded-[10px] border border-hairline-bright px-4 py-2 text-sm text-ink transition hover:border-vermillion"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-5 rounded-[10px] border border-hairline-bright px-4 py-2 text-sm text-ink transition hover:border-vermillion"
          >
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
