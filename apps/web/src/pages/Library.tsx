import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MEDIA_LABEL,
  MEDIA_TYPES,
  PROGRESS_UNIT,
  STATUS_LABEL,
  ENTRY_STATUSES,
} from '@kanzen/shared';
import { api } from '../lib/api';
import { Tabs } from '../components/ui/Tabs';
import { Select } from '../components/ui/Select';
import { Panel } from '../components/ui/primitives';
import { Constellation } from '../components/Constellation';
import { cn, titleOf } from '../lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  ...ENTRY_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];
const SORT_OPTIONS = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'title', label: 'Title' },
  { value: 'score', label: 'Score' },
  { value: 'progress', label: 'Progress' },
];

export function Library() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('updated');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const view = params.get('view') === 'constellation' ? 'constellation' : 'list';

  const list = useQuery({
    queryKey: ['library', { type, status, sort, q, page }],
    queryFn: () =>
      api.library({
        type: type === 'all' ? undefined : type,
        status: status || undefined,
        sort,
        q: q || undefined,
        page,
        pageSize: 30,
      }),
    enabled: view === 'list',
  });

  const graph = useQuery({
    queryKey: ['library-graph', { type, status }],
    queryFn: () =>
      api.libraryGraph({ type: type === 'all' ? undefined : type, status: status || undefined }),
    enabled: view === 'constellation',
  });

  const items = list.data?.items ?? [];
  const total =
    view === 'constellation' ? (graph.data?.nodes.length ?? 0) : (list.data?.total ?? 0);
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 30));
  const nodes = graph.data?.nodes ?? [];
  const links = graph.data?.links ?? [];

  const setView = (v: 'list' | 'constellation') => {
    const next = new URLSearchParams(params);
    if (v === 'constellation') next.set('view', 'constellation');
    else next.delete('view');
    setParams(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-vermillion">the library</p>
          <h1 className="font-display text-3xl text-ink">
            {total} {total === 1 ? 'title' : 'titles'}
          </h1>
        </div>
        <div className="flex rounded-[10px] border border-hairline p-0.5">
          {(['list', 'constellation'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-[8px] px-3 py-1.5 text-sm capitalize transition',
                view === v ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <Tabs
        value={type}
        onChange={(v) => {
          setType(v);
          setPage(1);
        }}
        tabs={[
          { value: 'all', label: 'All' },
          ...MEDIA_TYPES.map((t) => ({ value: t, label: MEDIA_LABEL[t] })),
        ]}
      />

      <div className="flex flex-wrap items-end gap-3">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search titles"
          className="min-w-[12rem] flex-1 rounded-[10px] border border-hairline bg-surface/70 px-3 py-2 text-sm text-ink outline-none focus:border-vermillion"
        />
        <Select value={status} options={STATUS_OPTIONS} onChange={setStatus} className="w-44" />
        <Select value={sort} options={SORT_OPTIONS} onChange={setSort} className="w-52" />
      </div>

      {view === 'constellation' ? (
        <Panel>
          {nodes.length > 2 ? (
            <Constellation
              nodes={nodes}
              links={links}
              height={560}
              onSelect={(id) => navigate(`/library/${id}`)}
            />
          ) : (
            <p className="text-sm text-ink-muted">Not enough titles in this filter to map.</p>
          )}
        </Panel>
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {list.isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-20 rounded-[14px]" />
                ))
              : items.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => navigate(`/library/${entry.id}`)}
                    className="glass flex items-center gap-3 p-3 text-left transition hover:border-hairline-bright"
                  >
                    <div
                      className="grid h-14 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-hairline bg-surface-2 text-[0.6rem] text-ink-faint"
                      style={
                        entry.work.coverImage
                          ? {
                              backgroundImage: `url(${entry.work.coverImage})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }
                          : undefined
                      }
                    >
                      {entry.work.coverImage ? '' : entry.work.type}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{titleOf(entry.work)}</p>
                      <p className="tabular text-xs text-ink-muted">
                        {STATUS_LABEL[entry.status]}
                        {entry.work.type === 'movie'
                          ? ''
                          : ` · ${entry.progress}${
                              entry.progressMax ? `/${entry.progressMax}` : ''
                            } ${PROGRESS_UNIT[entry.work.type]}`}
                        {entry.score ? ` · ${entry.score}` : ''}
                      </p>
                      <div className="mt-1 flex gap-1">
                        {entry.sources.map((s) => (
                          <span
                            key={s.provider}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: 'var(--color-aurora-teal)' }}
                            title={s.provider}
                          />
                        ))}
                        {entry.hasConflict ? (
                          <span className="ml-1 text-[0.65rem] text-gold">conflict</span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))}
          </div>

          {pages > 1 ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-hairline px-3 py-1 disabled:opacity-40"
              >
                prev
              </button>
              <span className="tabular text-ink-muted">
                {page} / {pages}
              </span>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-hairline px-3 py-1 disabled:opacity-40"
              >
                next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
