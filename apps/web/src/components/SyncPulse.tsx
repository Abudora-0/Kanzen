import { useQuery } from '@tanstack/react-query';
import { api, type LimiterSnapshot } from '../lib/api';
import type { SyncPulseState } from '../lib/stream';
import { PROVIDER_COLOR } from '../lib/utils';
import { useMotionPref } from '../lib/store';

type Props = { pulse: SyncPulseState };

/**
 * A radar readout of the background sync system: per provider rate limit budget,
 * circuit breaker state, and queue depth. The sweep line runs while work is in
 * flight.
 */
export function SyncPulse({ pulse }: Props) {
  const { reduceMotion } = useMotionPref();
  const { data } = useQuery({
    queryKey: ['sync-status'],
    queryFn: api.syncStatus,
    refetchInterval: pulse.active ? 1500 : 15000,
  });

  const limiters: LimiterSnapshot[] = data?.limiters ?? [];
  const queue = data?.queue ?? { waiting: 0, active: 0, delayed: 0, failed: 0 };
  const activeRuns = Object.entries(pulse.runs).filter(
    ([, r]) => r.state === 'running' || r.state === 'queued',
  );
  const size = 210;
  const cx = size / 2;

  return (
    <div className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base text-ink">Sync pulse</h3>
        <span className={`text-[0.7rem] ${pulse.active ? 'text-aurora-teal' : 'text-ink-faint'}`}>
          {pulse.active ? 'live' : 'idle'}
        </span>
      </div>

      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
          {[0.33, 0.66, 1].map((r) => (
            <circle
              key={r}
              cx={cx}
              cy={cx}
              r={(size / 2 - 8) * r}
              fill="none"
              stroke="var(--color-hairline)"
            />
          ))}
          <line x1={cx} y1="8" x2={cx} y2={size - 8} stroke="var(--color-hairline)" />
          <line x1="8" y1={cx} x2={size - 8} y2={cx} stroke="var(--color-hairline)" />
          {pulse.active && !reduceMotion ? (
            <g
              style={{ transformOrigin: 'center', animation: 'kanzen-sweep 2.4s linear infinite' }}
            >
              <path
                d={`M${cx} ${cx} L${cx} 8 A${size / 2 - 8} ${size / 2 - 8} 0 0 1 ${size - 20} ${cx * 0.6} Z`}
                fill="url(#sweep)"
              />
            </g>
          ) : null}
          <defs>
            <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-vermillion)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--color-vermillion)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {limiters.map((lim, i) => {
            const angle = (Math.PI * 2 * i) / Math.max(1, limiters.length) - Math.PI / 2;
            const budget = lim.reservoir == null ? 1 : Math.max(0.08, lim.reservoir / 90);
            const rr = (size / 2 - 14) * budget;
            const x = cx + Math.cos(angle) * rr;
            const y = cx + Math.sin(angle) * rr;
            return (
              <g key={lim.provider}>
                <line
                  x1={cx}
                  y1={cx}
                  x2={cx + Math.cos(angle) * (size / 2 - 14)}
                  y2={cx + Math.sin(angle) * (size / 2 - 14)}
                  stroke="var(--color-hairline)"
                  strokeDasharray="2 3"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={lim.queued > 0 ? 6 : 4}
                  fill={PROVIDER_COLOR[lim.provider] ?? 'var(--color-vermillion)'}
                  opacity={lim.breaker === 'open' ? 0.35 : 1}
                />
                {lim.breaker === 'open' ? (
                  <circle
                    cx={x}
                    cy={y}
                    r="9"
                    fill="none"
                    stroke="var(--color-gold)"
                    strokeWidth="1"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      {activeRuns.length > 0 ? (
        <div className="mt-4 space-y-1 border-b border-hairline pb-3 text-xs">
          {activeRuns.map(([runId, run]) => (
            <div key={runId} className="flex items-center justify-between">
              <span className="text-ink-soft">{run.provider}</span>
              <span className="tabular text-ink-muted">
                {run.total > 0 ? `${run.done} / ${run.total}` : run.state}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-1.5 text-xs">
        {limiters.map((lim) => (
          <div key={lim.provider} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-ink-soft">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: PROVIDER_COLOR[lim.provider] ?? 'var(--color-vermillion)' }}
              />
              {lim.provider}
            </span>
            <span className="tabular text-ink-muted">
              {lim.reservoir ?? '-'} left
              {lim.queued > 0 ? ` · ${lim.queued} queued` : ''}
              {lim.breaker !== 'closed' ? ` · breaker ${lim.breaker}` : ''}
            </span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-hairline pt-2 text-ink-faint">
          <span>queue</span>
          <span className="tabular">
            {queue.active} active · {queue.waiting + queue.delayed} pending
            {queue.failed ? ` · ${queue.failed} failed` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
