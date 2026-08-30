import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EntryDto } from '@kanzen/shared';
import { PROGRESS_UNIT } from '@kanzen/shared';
import { api } from '../lib/api';
import type { SyncPulseState } from '../lib/stream';
import { useAuth } from '../lib/store';
import { Counter } from '../components/ui/Counter';
import { Button, Panel, SectionTitle } from '../components/ui/primitives';
import { SyncPulse } from '../components/SyncPulse';
import { Constellation } from '../components/Constellation';
import { useConstellationData } from '../lib/constellation';
import { relativeTime, titleOf } from '../lib/utils';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pulse = useOutletContext<SyncPulseState>();

  const stats = useQuery({ queryKey: ['library-stats'], queryFn: api.libraryStats });
  const insights = useQuery({ queryKey: ['insights'], queryFn: api.insights });
  const inProgress = useQuery({
    queryKey: ['library', 'current'],
    queryFn: () => api.library({ status: 'current', pageSize: 80, sort: 'updated' }),
  });
  const runs = useQuery({
    queryKey: ['sync-runs'],
    queryFn: api.syncRuns,
    refetchInterval: pulse.active ? 2000 : false,
  });

  const bump = useMutation({
    mutationFn: (entry: EntryDto) =>
      api.updateEntry(entry.id, { progress: entry.progress + 1, status: 'current' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library'] });
      qc.invalidateQueries({ queryKey: ['library-stats'] });
    },
  });

  const totals = insights.data?.payload.totals;
  const { nodes, links } = useConstellationData(inProgress.data?.items ?? []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-vermillion">the deck</p>
          <h1 className="font-display text-3xl text-ink">
            {greeting()}, {user?.displayName?.split(' ')[0]}
          </h1>
        </div>
        <Button variant="primary" onClick={() => navigate('/connections')}>
          Sync now
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="titles tracked" value={stats.data?.total ?? 0} />
        <Stat label="hours logged" value={totals?.hoursWatched ?? 0} />
        <Stat label="mean score" value={totals?.meanScore ?? 0} decimals={1} />
        <Stat
          label="open conflicts"
          value={stats.data?.conflicts ?? 0}
          tone={stats.data?.conflicts ? 'warn' : 'default'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel>
          <SectionTitle eyebrow="in progress">Continue</SectionTitle>
          {inProgress.isLoading ? (
            <SkeletonRows />
          ) : (inProgress.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-muted">
              Nothing in progress.{' '}
              <Link className="text-vermillion" to="/library">
                Open the library
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {inProgress.data!.items.slice(0, 6).map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => navigate(`/library/${entry.id}`)}
                  >
                    <p className="truncate text-sm text-ink">{titleOf(entry.work)}</p>
                    <p className="tabular text-xs text-ink-muted">
                      {entry.progress}
                      {entry.progressMax ? ` / ${entry.progressMax}` : ''}{' '}
                      {PROGRESS_UNIT[entry.work.type]}
                      {entry.hasConflict ? ' · conflict' : ''}
                    </p>
                  </button>
                  <button
                    className="rounded-md border border-hairline-bright px-2 py-1 text-xs text-ink transition hover:border-vermillion"
                    onClick={() => bump.mutate(entry)}
                    disabled={bump.isPending}
                  >
                    +1
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <SyncPulse pulse={pulse} />
      </div>

      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle eyebrow="what you are watching now" className="mb-0">
            Constellation
          </SectionTitle>
          <Link
            to="/library?view=constellation"
            className="text-sm text-aurora-teal hover:text-ink"
          >
            open full map
          </Link>
        </div>
        {nodes.length > 2 ? (
          <Constellation
            nodes={nodes}
            links={links}
            height={360}
            onSelect={(id) => navigate(`/library/${id}`)}
          />
        ) : (
          <p className="text-sm text-ink-muted">Sync a platform to populate your star map.</p>
        )}
      </Panel>

      <Panel>
        <SectionTitle eyebrow="history">Recent sync runs</SectionTitle>
        <ul className="space-y-1.5 text-sm">
          {(runs.data?.runs ?? []).slice(0, 6).map((run) => (
            <li key={run.id} className="flex items-center justify-between">
              <span className="text-ink-soft">
                {run.provider} · {run.mode}
              </span>
              <span className="tabular text-xs text-ink-muted">
                {run.state === 'done'
                  ? `+${run.stats.created} new, ${run.stats.updated} updated, ${run.stats.conflicts} conflicts`
                  : run.state}{' '}
                · {relativeTime(run.finishedAt ?? run.startedAt)}
              </span>
            </li>
          ))}
          {(runs.data?.runs.length ?? 0) === 0 ? (
            <li className="text-ink-muted">No sync runs yet.</li>
          ) : null}
        </ul>
      </Panel>
    </div>
  );
}

function Stat({
  label,
  value,
  decimals,
  tone = 'default',
}: {
  label: string;
  value: number;
  decimals?: number;
  tone?: 'default' | 'warn';
}) {
  return (
    <div className="glass p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-ink-muted">{label}</p>
      <p
        className={`mt-1 font-display text-3xl ${tone === 'warn' && value > 0 ? 'text-gold' : 'text-ink'}`}
      >
        <Counter value={value} decimals={decimals} />
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton h-8 rounded-md" />
      ))}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}
