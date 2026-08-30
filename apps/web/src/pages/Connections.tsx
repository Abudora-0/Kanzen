import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Panel, SectionTitle, Button, Badge } from '../components/ui/primitives';
import { PROVIDER_COLOR, relativeTime } from '../lib/utils';

export function Connections() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = useQuery({ queryKey: ['connections'], queryFn: api.connections });
  const runs = useQuery({ queryKey: ['sync-runs'], queryFn: api.syncRuns, refetchInterval: 4000 });

  const connect = useMutation({
    mutationFn: api.connect,
    onSuccess: (res) => {
      if (res.authUrl) window.location.href = res.authUrl;
      else qc.invalidateQueries({ queryKey: ['connections'] });
    },
  });
  const disconnect = useMutation({
    mutationFn: api.disconnect,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
  const sync = useMutation({
    mutationFn: (provider?: string) => api.sync({ provider, mode: 'incremental' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sync-runs'] });
      qc.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });

  useEffect(() => {
    if (params.get('connected') || params.get('error')) {
      qc.invalidateQueries({ queryKey: ['connections'] });
      const t = setTimeout(() => setParams({}), 4000);
      return () => clearTimeout(t);
    }
  }, [params, qc, setParams]);

  if (isLoading || !data) return <div className="skeleton h-96 rounded-[18px]" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-vermillion">connections</p>
          <h1 className="font-display text-3xl text-ink">Platforms</h1>
          {data.demoMode ? (
            <p className="mt-1 text-xs text-aurora-teal">
              demo mode: providers serve fixture data, no real OAuth needed
            </p>
          ) : null}
        </div>
        <Button variant="primary" onClick={() => sync.mutate(undefined)} loading={sync.isPending}>
          Sync all
        </Button>
      </div>

      {params.get('connected') ? (
        <div className="rounded-[10px] border border-aurora-teal/40 bg-aurora-teal/10 p-3 text-sm text-aurora-teal">
          Connected {params.get('connected')}. First sync is running.
        </div>
      ) : null}
      {params.get('error') ? (
        <div className="rounded-[10px] border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
          That connection did not complete ({params.get('error')}).
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {data.catalogue.map((item) => {
          const conn = data.connections.find((c) => c.provider === item.provider);
          return (
            <div key={item.provider} className="glass p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-8 w-8 rounded-lg"
                    style={{ background: PROVIDER_COLOR[item.provider] ?? '#e2542f' }}
                  />
                  <div>
                    <p className="font-display text-ink">{item.meta.name}</p>
                    <p className="text-xs text-ink-muted">{item.meta.media.join(', ')}</p>
                  </div>
                </div>
                {item.meta.status === 'stub' ? (
                  <Badge tone="warn">stub adapter</Badge>
                ) : (
                  <Badge tone="teal">live</Badge>
                )}
              </div>

              <p className="mt-3 text-xs text-ink-faint">
                {item.meta.rateLimit.requestsPerMinute} req/min · burst {item.meta.rateLimit.burst}
              </p>

              <div className="mt-4 flex items-center justify-between">
                {conn ? (
                  <span className="text-sm text-ink-soft">
                    {conn.handle ?? 'connected'} · {conn.entryCount} entries
                    <span className="block text-xs text-ink-faint">
                      last sync {relativeTime(conn.lastSyncedAt)}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-ink-muted">not connected</span>
                )}
                <div className="flex gap-2">
                  {conn ? (
                    <>
                      <Button onClick={() => sync.mutate(item.provider)}>Sync</Button>
                      <Button
                        variant="quiet"
                        onClick={() => disconnect.mutate(item.provider)}
                        loading={disconnect.isPending}
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => connect.mutate(item.provider)}
                      loading={connect.isPending}
                      disabled={!item.configured}
                    >
                      {item.configured ? 'Connect' : 'Needs keys'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Panel>
        <SectionTitle eyebrow="queue history">Sync runs</SectionTitle>
        <ul className="space-y-1.5 text-sm">
          {(runs.data?.runs ?? []).map((run) => (
            <li key={run.id} className="flex items-center justify-between">
              <span className="text-ink-soft">
                {run.provider} · {run.mode}
              </span>
              <span className="tabular text-xs text-ink-muted">
                {run.state}
                {run.state === 'done'
                  ? ` · +${run.stats.created} / ${run.stats.updated} upd / ${run.stats.conflicts} conf`
                  : ''}{' '}
                · {relativeTime(run.finishedAt ?? run.startedAt)}
              </span>
            </li>
          ))}
          {(runs.data?.runs.length ?? 0) === 0 ? (
            <li className="text-ink-muted">No runs yet.</li>
          ) : null}
        </ul>
      </Panel>
    </div>
  );
}
