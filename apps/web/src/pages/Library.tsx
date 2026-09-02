import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EntryDto } from '@kanzen/shared';
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
import { CoverImage } from '../components/CoverImage';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { useToast } from '../lib/toast';
import { cn, PROVIDER_COLOR, titleOf } from '../lib/utils';

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
const VIEWS = ['grid', 'list', 'constellation'] as const;
type View = (typeof VIEWS)[number];

export function Library() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('updated');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const viewParam = params.get('view');
  const view: View = (VIEWS as readonly string[]).includes(viewParam ?? '')
    ? (viewParam as View)
    : 'grid';

  const list = useQuery({
    queryKey: ['library', { type, status, sort, q, page }],
    queryFn: () =>
      api.library({
        type: type === 'all' ? undefined : type,
        status: status || undefined,
        sort,
        q: q || undefined,
        page,
        pageSize: 36,
      }),
    enabled: view !== 'constellation',
  });

  const graph = useQuery({
    queryKey: ['library-graph', { type, status }],
    queryFn: () =>
      api.libraryGraph({ type: type === 'all' ? undefined : type, status: status || undefined }),
    enabled: view === 'constellation',
  });

  const bump = useMutation({
    mutationFn: (entry: EntryDto) =>
      api.updateEntry(entry.id, { progress: entry.progress + 1, status: 'current' }),
    onSuccess: (_r, entry) => {
      toast.show(`+1 on ${titleOf(entry.work)}`);
      qc.invalidateQueries({ queryKey: ['library'] });
      qc.invalidateQueries({ queryKey: ['library-stats'] });
    },
  });

  const items = list.data?.items ?? [];
  const total =
    view === 'constellation' ? (graph.data?.nodes.length ?? 0) : (list.data?.total ?? 0);
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 36));
  const nodes = graph.data?.nodes ?? [];
  const links = graph.data?.links ?? [];

  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'grid') next.delete('view');
    else next.set('view', v);
    setParams(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-vermillion">the library</p>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">
            {total} {total === 1 ? 'title' : 'titles'}
          </h1>
        </div>
        <div className="flex rounded-[10px] border border-hairline p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-label={`${v} view`}
              className={cn(
                'flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-xs capitalize transition sm:text-sm',
                view === v ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              <Icon
                name={v === 'grid' ? 'library' : v === 'list' ? 'menu' : 'insights'}
                size={15}
              />
              <span className="hidden sm:inline">{v}</span>
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search titles"
            className="w-full rounded-[10px] border border-hairline bg-surface/70 py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-vermillion"
          />
        </div>
        <div className="flex gap-3">
          <Select
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
            className="flex-1 sm:w-40"
          />
          <Select
            value={sort}
            options={SORT_OPTIONS}
            onChange={setSort}
            className="flex-1 sm:w-48"
          />
        </div>
      </div>

      {view === 'constellation' ? (
        <Panel>
          {nodes.length > 2 ? (
            <Constellation
              nodes={nodes}
              links={links}
              height={520}
              onSelect={(id) => navigate(`/library/${id}`)}
            />
          ) : (
            <p className="py-8 text-center text-sm text-ink-muted">
              Not enough titles in this filter to map.
            </p>
          )}
        </Panel>
      ) : list.isLoading ? (
        <PosterSkeleton grid={view === 'grid'} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing here"
          body={
            q ? `No titles match "${q}".` : 'Adjust the filters, or connect a platform to sync.'
          }
          action={{ label: 'Go to connections', to: '/connections' }}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((entry) => (
            <PosterCard
              key={entry.id}
              entry={entry}
              onOpen={() => navigate(`/library/${entry.id}`)}
              onBump={() => bump.mutate(entry)}
              bumping={bump.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {items.map((entry) => (
            <button
              key={entry.id}
              onClick={() => navigate(`/library/${entry.id}`)}
              className="glass glass-hover flex items-center gap-3 p-2.5 text-left"
            >
              <CoverImage
                src={entry.work.coverImage}
                alt={titleOf(entry.work)}
                type={entry.work.type}
                className="h-16 w-12 shrink-0"
              />
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
                <div className="mt-1 flex items-center gap-1">
                  {entry.sources.map((s) => (
                    <span
                      key={s.provider}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: PROVIDER_COLOR[s.provider] ?? 'var(--color-sage)' }}
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
      )}

      {view !== 'constellation' && pages > 1 ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-hairline px-3 py-1.5 transition hover:border-hairline-bright disabled:opacity-40"
          >
            prev
          </button>
          <span className="tabular text-ink-muted">
            {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-hairline px-3 py-1.5 transition hover:border-hairline-bright disabled:opacity-40"
          >
            next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PosterCard({
  entry,
  onOpen,
  onBump,
  bumping,
}: {
  entry: EntryDto;
  onOpen: () => void;
  onBump: () => void;
  bumping: boolean;
}) {
  const pct = entry.progressMax ? Math.min(100, (entry.progress / entry.progressMax) * 100) : 0;
  return (
    <div className="group relative">
      <button
        onClick={onOpen}
        className="lift block w-full overflow-hidden rounded-[12px] border border-hairline text-left"
      >
        <CoverImage
          src={entry.work.coverImage}
          alt={titleOf(entry.work)}
          type={entry.work.type}
          rounded="rounded-none"
          className="aspect-[2/3] w-full"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2.5 pt-7">
          <p className="line-clamp-2 text-xs font-medium leading-snug text-white drop-shadow">
            {titleOf(entry.work)}
          </p>
          <p className="tabular mt-0.5 text-[0.65rem] text-white/75">
            {STATUS_LABEL[entry.status]}
            {entry.score ? ` · ${entry.score}` : ''}
          </p>
        </div>
        {entry.hasConflict ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-gold px-1.5 py-0.5 text-[0.6rem] font-semibold text-[#2a1c05]">
            !
          </span>
        ) : null}
        {pct > 0 && pct < 100 ? (
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-black/30">
            <span className="block h-full bg-vermillion" style={{ width: `${pct}%` }} />
          </span>
        ) : null}
      </button>
      {entry.work.type !== 'movie' ? (
        <button
          onClick={onBump}
          disabled={bumping}
          aria-label="Log one more"
          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border border-hairline-bright bg-night/80 text-ink opacity-0 backdrop-blur transition group-hover:opacity-100 hover:border-vermillion"
        >
          <Icon name="plus" size={14} />
        </button>
      ) : null}
    </div>
  );
}

function PosterSkeleton({ grid }: { grid: boolean }) {
  return grid ? (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton aspect-[2/3] rounded-[12px]" />
      ))}
    </div>
  ) : (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton h-20 rounded-[14px]" />
      ))}
    </div>
  );
}
