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
      <svg viewBox="0 0 64 64" className="mb-4 h-14 w-14 opacity-30">
        <line
          x1="12"
          y1="54"
          x2="52"
          y2="54"
          stroke="var(--color-aurora-teal)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <g fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round">
          <path d="M20 18v36 M44 18v36 M16 26h32" />
          <path d="M8 16 Q32 8 56 16" strokeWidth="5" />
        </g>
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
