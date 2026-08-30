import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STATUS_LABEL } from '@kanzen/shared';
import { api } from '../lib/api';
import { Panel, SectionTitle, Button } from '../components/ui/primitives';
import { RadarChart } from '../components/viz/RadarChart';
import { VelocityChart } from '../components/viz/VelocityChart';
import { Heatmap } from '../components/viz/Heatmap';
import { BarMeter } from '../components/viz/BarMeter';
import { Counter } from '../components/ui/Counter';

export function Insights() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['insights'], queryFn: api.insights });
  const refresh = useMutation({
    mutationFn: api.refreshInsights,
    onSuccess: (res) => qc.setQueryData(['insights'], res),
  });

  if (isLoading || !data) return <div className="skeleton h-[40rem] rounded-[18px]" />;
  const p = data.payload;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-vermillion">insights</p>
          <h1 className="font-display text-3xl text-ink">What the aggregation found</h1>
          <p className="mt-1 text-xs text-ink-faint">
            snapshot from {new Date(p.generatedAt).toLocaleString()}
            {data.cached ? ' · served from cache' : ` · computed in ${data.computeMs}ms`}
          </p>
        </div>
        <Button onClick={() => refresh.mutate()} loading={refresh.isPending}>
          Recompute
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="entries" value={p.totals.entries} />
        <Tile label="hours" value={p.totals.hoursWatched} />
        <Tile label="mean score" value={p.totals.meanScore} decimals={1} />
        <Tile label="conflicts" value={p.drift.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <SectionTitle eyebrow="genres and tags, weighted">Taste fingerprint</SectionTitle>
          <RadarChart axes={p.taste} />
        </Panel>

        <Panel>
          <SectionTitle eyebrow="monthly, with trailing mean">Completion velocity</SectionTitle>
          <VelocityChart points={p.velocity} />
          <p className="mt-2 text-xs text-ink-faint">
            bars are titles finished that month, the line is a three month average
          </p>
        </Panel>
      </div>

      <Panel>
        <SectionTitle eyebrow="one $facet, five cuts">Library profile</SectionTitle>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">status</p>
            <BarMeter
              rows={p.profile.statusBreakdown.map((s) => ({
                label: STATUS_LABEL[s.status],
                value: s.count,
              }))}
            />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">format</p>
            <BarMeter
              accent="var(--color-aurora-violet)"
              rows={p.profile.formatBreakdown.map((f) => ({ label: f.format, value: f.count }))}
            />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">top studios</p>
            <BarMeter
              accent="var(--color-aurora-teal)"
              rows={p.profile.topStudios.map((s) => ({
                label: s.studio,
                value: s.count,
                hint: `avg ${s.meanScore}`,
              }))}
              formatValue={(v) => `${v}`}
            />
          </div>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">
              score histogram ($bucket)
            </p>
            <div className="flex items-end gap-1.5" style={{ height: 120 }}>
              {p.profile.scoreHistogram.map((b) => {
                const max = Math.max(1, ...p.profile.scoreHistogram.map((x) => x.count));
                return (
                  <div
                    key={b.from}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  >
                    <span className="tabular text-[0.65rem] text-ink-muted">{b.count}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-vermillion-deep to-vermillion"
                      style={{ height: `${Math.max(4, (b.count / max) * 100)}%` }}
                    />
                    <span className="tabular text-[0.6rem] text-ink-faint">
                      {b.from}-{b.to}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">by release decade</p>
            <BarMeter
              accent="var(--color-gold)"
              rows={p.profile.decadeDistribution.map((d) => ({ label: d.decade, value: d.count }))}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionTitle eyebrow="activity log, 53 weeks">Watch and read heatmap</SectionTitle>
        <Heatmap cells={p.heatmap} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <SectionTitle eyebrow="$graphLookup over relations">Franchise depth</SectionTitle>
          <ul className="space-y-3">
            {p.franchises.map((f) => (
              <li key={f.rootWorkId}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{f.title}</span>
                  <span className="tabular text-ink-muted">
                    {f.owned} / {f.total}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-aurora-violet"
                    style={{ width: `${(f.owned / f.total) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            {p.franchises.length === 0 ? (
              <li className="text-sm text-ink-muted">No multi part franchises tracked yet.</li>
            ) : null}
          </ul>
        </Panel>

        <Panel>
          <SectionTitle eyebrow="pace times remaining">Predicted finishes</SectionTitle>
          <ul className="space-y-2 text-sm">
            {p.predictions.map((pred) => (
              <li key={pred.workId} className="flex items-center justify-between">
                <span className="text-ink-soft">{pred.title}</span>
                <span className="tabular text-xs text-ink-muted">
                  {pred.remaining} {pred.unit} left ·{' '}
                  {pred.eta ? `~${pred.eta}` : 'need more history'} · {pred.confidence}
                </span>
              </li>
            ))}
            {p.predictions.length === 0 ? (
              <li className="text-ink-muted">Nothing in progress to predict.</li>
            ) : null}
          </ul>
        </Panel>
      </div>

      <Panel>
        <SectionTitle eyebrow="entries where platforms disagree">Cross platform drift</SectionTitle>
        {p.drift.length === 0 ? (
          <p className="text-sm text-aurora-teal">Everything is in sync.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {p.drift.map((d) => (
              <li
                key={d.workId}
                className="flex cursor-pointer items-center justify-between py-2.5 transition hover:text-ink"
                onClick={() => navigate(`/library?q=${encodeURIComponent(d.title)}`)}
              >
                <div>
                  <p className="text-sm text-ink-soft">{d.title}</p>
                  <p className="text-xs text-ink-faint">
                    {d.kind} · {d.detail}
                  </p>
                </div>
                <span className="text-xs text-gold">{d.providers.join(' vs ')}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Tile({ label, value, decimals }: { label: string; value: number; decimals?: number }) {
  return (
    <div className="glass p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">
        <Counter value={value} decimals={decimals} />
      </p>
    </div>
  );
}
