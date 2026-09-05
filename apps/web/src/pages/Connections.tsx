import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Panel, SectionTitle, Button, Badge } from '../components/ui/primitives';
import { EmptyState } from '../components/EmptyState';
import { ProviderIcon } from '../components/ProviderIcon';
import { useToast } from '../lib/toast';
import { PROVIDER_COLOR, relativeTime } from '../lib/utils';

export function Connections() {
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = useQuery({ queryKey: ['connections'], queryFn: api.connections });
  const runs = useQuery({ queryKey: ['sync-runs'], queryFn: api.syncRuns, refetchInterval: 4000 });

  const connect = useMutation({
    mutationFn: api.connect,
    onSuccess: (res) => {
      if (res.authUrl) window.location.href = res.authUrl;
      else {
        qc.invalidateQueries({ queryKey: ['connections'] });
        toast.show('Platform connected');
      }
    },
    onError: () => toast.show('Could not start that connection', 'error'),
  });
  const disconnect = useMutation({
    mutationFn: api.disconnect,
    onSuccess: (_res, provider) => {
      qc.invalidateQueries({ queryKey: ['connections'] });
      toast.show(`Removed ${provider}`, 'warn');
    },
  });
  const sync = useMutation({
    mutationFn: (provider?: string) => api.sync({ provider, mode: 'incremental' }),
    onSuccess: (_res, provider) => {
      qc.invalidateQueries({ queryKey: ['sync-runs'] });
      qc.invalidateQueries({ queryKey: ['sync-status'] });
      toast.show(provider ? `Sync started for ${provider}` : 'Sync started for all platforms');
    },
    onError: () => toast.show('Sync could not start', 'error'),
  });

  const handledConnect = useRef<string | null>(null);
  useEffect(() => {
    const connected = params.get('connected');
    if (connected || params.get('error')) {
      qc.invalidateQueries({ queryKey: ['connections'] });
      // kick off the first sync for a freshly connected platform, once
      if (connected && handledConnect.current !== connected) {
        handledConnect.current = connected;
        sync.mutate(connected);
      }
      const t = setTimeout(() => setParams({}), 6000);
      return () => clearTimeout(t);
    }
  }, [params, qc, setParams, sync]);

  if (isLoading || !data) return <div className="skeleton h-96 rounded-[18px]" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-vermillion">trackers</p>
          <h1 className="font-display text-3xl text-ink">Your trackers</h1>
          <p className="mt-1 max-w-md text-sm text-ink-muted">
            Connect the accounts you track on elsewhere. Kanzen keeps them in one library.
          </p>
          {data.demoMode ? (
            <p className="mt-1 text-xs text-sage">
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
            <div key={item.provider} className="glass glass-hover lift p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                    style={{
                      background: PROVIDER_COLOR[item.provider] ?? 'var(--color-vermillion)',
                    }}
                  >
                    <ProviderIcon provider={item.provider} size={17} />
                  </span>
                  <div>
                    <p className="font-display text-ink">{item.meta.name}</p>
                    <p className="text-xs text-ink-muted">{item.meta.media.join(', ')}</p>
                  </div>
                </div>
                {item.meta.status === 'stub' ? (
                  <Badge tone="neutral">not available</Badge>
                ) : data.demoMode ? (
                  <Badge tone="violet">demo data</Badge>
                ) : item.configured ? (
                  <Badge tone="teal">live</Badge>
                ) : (
                  <Badge tone="warn">needs keys</Badge>
                )}
              </div>

              <p className="mt-3 text-xs text-ink-faint">
                {item.meta.rateLimit.requestsPerMinute} req/min · burst {item.meta.rateLimit.burst}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
                {conn ? (
                  <span className="text-sm text-ink-soft">
                    {conn.handle ?? 'connected'} · {conn.entryCount} entries
                    <span className="block text-xs text-ink-faint">
                      last sync {relativeTime(conn.lastSyncedAt)}
                    </span>
                  </span>
                ) : item.meta.auth === 'password' && !data.demoMode ? null : (
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
                  ) : item.meta.auth === 'password' && !data.demoMode ? null : (
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

              {!conn && item.meta.auth === 'password' && !data.demoMode ? (
                <PasswordConnect
                  provider={item.provider}
                  name={item.meta.name}
                  onDone={() => {
                    qc.invalidateQueries({ queryKey: ['connections'] });
                    qc.invalidateQueries({ queryKey: ['sync-runs'] });
                    toast.show(`Connected ${item.meta.name}`);
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <Panel>
        <SectionTitle eyebrow="queue history">Sync runs</SectionTitle>
        {(runs.data?.runs.length ?? 0) === 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-8"
            title="No sync runs yet"
            body="Connect a platform and hit Sync to see the queue work through it here."
          />
        ) : (
          <ul className="space-y-1.5 text-sm">
            {(runs.data?.runs ?? []).map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
              >
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
          </ul>
        )}
      </Panel>
    </div>
  );
}

function PasswordConnect({
  provider,
  name,
  onDone,
}: {
  provider: string;
  name: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const link = useMutation({
    mutationFn: () => api.connectCredentials(provider, { username, password }),
    onSuccess: () => {
      setPassword('');
      setOpen(false);
      onDone();
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : `${name} did not accept those details.`),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    link.mutate();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-sm text-vermillion transition hover:text-vermillion-bright"
      >
        Sign in to {name}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t border-hairline pt-3">
      <p className="text-xs text-ink-faint">
        {name} has no third-party OAuth, so it takes your login directly. Your password is exchanged
        for a token once and never stored.
      </p>
      <input
        type="email"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder={`${name} email`}
        className="w-full rounded-[10px] border border-hairline bg-surface/70 px-3 py-2 text-sm text-ink outline-none transition focus:border-vermillion"
      />
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded-[10px] border border-hairline bg-surface/70 px-3 py-2 text-sm text-ink outline-none transition focus:border-vermillion"
      />
      {error ? <p className="text-xs text-vermillion-bright">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={link.isPending}>
          Link {name}
        </Button>
        <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
