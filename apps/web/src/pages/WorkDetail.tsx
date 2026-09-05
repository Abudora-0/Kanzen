import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENTRY_STATUSES, PROGRESS_UNIT, STATUS_LABEL } from '@kanzen/shared';
import { api, ApiError } from '../lib/api';
import { Panel, SectionTitle, Button, Badge } from '../components/ui/primitives';
import { Select } from '../components/ui/Select';
import { Slider } from '../components/ui/Slider';
import { CoverImage } from '../components/CoverImage';
import { Celebrate } from '../components/Celebrate';
import { Icon } from '../components/Icon';
import { useToast } from '../lib/toast';
import { PROVIDER_COLOR, titleOf } from '../lib/utils';

export function WorkDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['entry', id], queryFn: () => api.entry(id) });

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('planning');
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState('');
  const [spark, setSpark] = useState(0);

  useEffect(() => {
    if (!data) return;
    setProgress(data.entry.progress);
    setStatus(data.entry.status);
    setScore(data.entry.score ?? 0);
    setNotes(data.entry.notes);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.updateEntry(id, { progress, status, score: score || undefined, notes }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['entry', id] });
      qc.invalidateQueries({ queryKey: ['library'] });
      qc.invalidateQueries({ queryKey: ['insights'] });
      qc.invalidateQueries({ queryKey: ['library-stats'] });
      const done = res.entry.status === 'completed' && data?.entry.status !== 'completed';
      toast.show(res.entry.status === 'completed' ? 'Marked complete' : 'Saved');
      if (done) setSpark((s) => s + 1);
    },
  });

  const resolve = useMutation({
    mutationFn: (strategy: 'prefer-local' | 'prefer-remote' | 'prefer-furthest') =>
      api.resolveConflict(id, strategy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entry', id] });
      toast.show('Conflict resolved');
    },
  });

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      progress !== data.entry.progress ||
      status !== data.entry.status ||
      score !== (data.entry.score ?? 0) ||
      notes !== data.entry.notes
    );
  }, [data, progress, status, score, notes]);

  if (isLoading || !data) return <div className="skeleton h-[32rem] rounded-[18px]" />;

  const { entry, work, relatedProgress } = data;
  const max =
    entry.progressMax ?? work.episodes ?? work.chapters ?? (work.type === 'movie' ? 1 : 100);

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
      >
        <Icon name="chevron-right" size={15} className="rotate-180" />
        back
      </button>

      {/* hero */}
      <div className="glass relative overflow-hidden">
        <div className="absolute inset-0">
          {work.bannerImage ? (
            <img src={work.bannerImage} alt="" className="h-full w-full object-cover opacity-20" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/92 to-surface/55" />
        </div>
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-7">
          <div className="relative h-44 w-32 shrink-0 sm:h-52 sm:w-36">
            <CoverImage
              src={work.coverImage}
              alt={titleOf(work)}
              type={work.type}
              className="h-full w-full shadow-lift"
            />
            <CoverActions workId={work.id} coverImage={work.coverImage} title={titleOf(work)} />
          </div>
          <div className="min-w-0">
            <p
              className="text-[0.7rem] uppercase tracking-[0.3em]"
              style={{ color: `var(--color-media-${work.type})` }}
            >
              {work.type}
            </p>
            <h1 className="mt-1 font-display text-2xl leading-tight text-ink sm:text-3xl">
              {titleOf(work)}
            </h1>
            {work.title.native ? (
              <p className="text-sm text-ink-muted">{work.title.native}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {work.year ? <Badge>{work.year}</Badge> : null}
              {work.format ? <Badge>{work.format}</Badge> : null}
              {work.meanScore ? <Badge tone="teal">avg {work.meanScore}</Badge> : null}
              {work.studios.slice(0, 2).map((s) => (
                <Badge key={s} tone="violet">
                  {s}
                </Badge>
              ))}
            </div>
            {work.genres.length ? (
              <p className="mt-2.5 text-sm text-ink-muted">{work.genres.join(' · ')}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel>
          <SectionTitle eyebrow="log">Your progress</SectionTitle>
          {work.type === 'movie' ? (
            <label className="flex items-center gap-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={progress >= 1}
                onChange={(e) => setProgress(e.target.checked ? 1 : 0)}
                className="h-4 w-4 accent-[var(--color-vermillion)]"
              />
              Watched
            </label>
          ) : (
            <Slider
              value={progress}
              max={max}
              onChange={setProgress}
              label={PROGRESS_UNIT[work.type]}
              unit={PROGRESS_UNIT[work.type]}
            />
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={ENTRY_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
            <Slider value={score} max={10} step={0.5} onChange={setScore} label="Score" />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes to yourself"
            rows={3}
            className="mt-4 w-full rounded-[10px] border border-hairline bg-night-2/70 px-3 py-2 text-sm text-ink outline-none transition focus:border-vermillion"
          />
        </Panel>

        <div className="space-y-4">
          <Panel>
            <SectionTitle eyebrow="per platform">Sources</SectionTitle>
            <ul className="space-y-2 text-sm">
              {entry.sources.map((s) => (
                <li key={s.provider} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-soft">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: PROVIDER_COLOR[s.provider] ?? 'var(--color-vermillion)',
                      }}
                    />
                    {s.provider}
                  </span>
                  <span className="tabular text-ink-muted">
                    {STATUS_LABEL[s.status]} · {s.progress}
                    {s.score ? ` · ${s.score}` : ''}
                    {s.dirty ? ' · pending' : ''}
                  </span>
                </li>
              ))}
              {entry.sources.length === 0 ? (
                <li className="text-ink-muted">Only tracked in Kanzen.</li>
              ) : null}
            </ul>
            {entry.hasConflict ? (
              <div className="mt-4 rounded-[10px] border border-gold/40 bg-gold/10 p-3">
                <p className="text-sm text-gold">These platforms disagree.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => resolve.mutate('prefer-furthest')}>
                    Take furthest
                  </Button>
                  <Button variant="ghost" onClick={() => resolve.mutate('prefer-local')}>
                    Keep mine
                  </Button>
                  <Button variant="ghost" onClick={() => resolve.mutate('prefer-remote')}>
                    Take newest remote
                  </Button>
                </div>
              </div>
            ) : null}
          </Panel>

          {work.relations.length ? (
            <Panel>
              <SectionTitle eyebrow="franchise">Related</SectionTitle>
              <ul className="space-y-1.5 text-sm">
                {work.relations.map((rel) => {
                  const prog = relatedProgress.find((r) => r.workId === rel.workId);
                  return (
                    <li key={rel.workId} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-ink-soft">
                        {rel.displayTitle || 'Related work'}{' '}
                        <span className="text-ink-faint">
                          · {rel.relationType.replace('_', ' ')}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-xs text-ink-muted">
                        {prog
                          ? STATUS_LABEL[prog.status as keyof typeof STATUS_LABEL]
                          : 'not tracked'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>

      {/* save bar - inline on desktop, sticky on mobile */}
      <div className="sticky bottom-3 z-20 flex items-center gap-3 sm:static">
        <div className="glass flex flex-1 items-center gap-3 p-3 sm:flex-none sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <span className="relative">
            <Celebrate trigger={spark} />
            <Button
              variant="primary"
              onClick={() => save.mutate()}
              loading={save.isPending}
              disabled={!dirty}
            >
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
          </span>
          {dirty ? (
            <span className="text-xs text-ink-muted">unsaved changes</span>
          ) : save.isSuccess ? (
            <span className="text-xs text-aurora-teal">writeback queued</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CoverActions({
  workId,
  coverImage,
  title,
}: {
  workId: string;
  coverImage: string | null;
  title: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setCover = useMutation({
    mutationFn: () => api.setWorkCover(workId, url.trim()),
    onSuccess: () => {
      setEditing(false);
      setUrl('');
      qc.invalidateQueries({ queryKey: ['entry'] });
      qc.invalidateQueries({ queryKey: ['library'] });
      toast.show('Cover updated');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not use that image URL.'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError('Paste an image URL.');
      return;
    }
    setCover.mutate();
  };

  if (editing) {
    return (
      <div className="absolute inset-x-0 bottom-0 z-10 -mx-1">
        <div className="glass space-y-1.5 p-2">
          <form onSubmit={submit} className="space-y-1.5">
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://... image url"
              className="w-full rounded-[8px] border border-hairline bg-surface/80 px-2 py-1 text-xs text-ink outline-none focus:border-vermillion"
            />
            {error ? <p className="text-[0.65rem] text-vermillion-bright">{error}</p> : null}
            <div className="flex gap-1.5">
              <Button
                type="submit"
                variant="primary"
                className="!px-2 !py-1 text-xs"
                loading={setCover.isPending}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="quiet"
                className="!px-2 !py-1 text-xs"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-1.5 right-1.5 z-10 flex gap-1">
      {coverImage ? (
        <a
          href={coverImage}
          download={`${title}-cover.jpg`}
          target="_blank"
          rel="noreferrer"
          aria-label="Download cover"
          title="Download cover"
          className="grid h-7 w-7 place-items-center rounded-full border border-hairline-bright bg-night/80 text-ink backdrop-blur transition hover:border-vermillion"
        >
          <Icon name="download" size={14} />
        </a>
      ) : null}
      <button
        onClick={() => setEditing(true)}
        aria-label={coverImage ? 'Change cover' : 'Add a cover'}
        title={coverImage ? 'Change cover' : 'Add a cover'}
        className="grid h-7 w-7 place-items-center rounded-full border border-hairline-bright bg-night/80 text-ink backdrop-blur transition hover:border-vermillion"
      >
        <Icon name="image" size={14} />
      </button>
    </div>
  );
}
