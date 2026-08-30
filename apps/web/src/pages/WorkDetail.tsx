import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENTRY_STATUSES, PROGRESS_UNIT, STATUS_LABEL } from '@kanzen/shared';
import { api } from '../lib/api';
import { Panel, SectionTitle, Button, Badge } from '../components/ui/primitives';
import { Select } from '../components/ui/Select';
import { Slider } from '../components/ui/Slider';
import { PROVIDER_COLOR, titleOf } from '../lib/utils';

export function WorkDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['entry', id], queryFn: () => api.entry(id) });

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('planning');
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!data) return;
    setProgress(data.entry.progress);
    setStatus(data.entry.status);
    setScore(data.entry.score ?? 0);
    setNotes(data.entry.notes);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.updateEntry(id, { progress, status, score: score || undefined, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entry', id] });
      qc.invalidateQueries({ queryKey: ['library'] });
      qc.invalidateQueries({ queryKey: ['insights'] });
    },
  });

  const resolve = useMutation({
    mutationFn: (strategy: 'prefer-local' | 'prefer-remote' | 'prefer-furthest') =>
      api.resolveConflict(id, strategy),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entry', id] }),
  });

  if (isLoading || !data) return <div className="skeleton h-96 rounded-[18px]" />;

  const { entry, work, relatedProgress } = data;
  const max =
    entry.progressMax ?? work.episodes ?? work.chapters ?? (work.type === 'movie' ? 1 : 100);
  const dirty =
    progress !== entry.progress ||
    status !== entry.status ||
    score !== (entry.score ?? 0) ||
    notes !== entry.notes;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm text-ink-muted hover:text-ink">
        back
      </button>

      <div
        className="glass relative overflow-hidden p-6"
        style={
          work.bannerImage
            ? {
                backgroundImage: `linear-gradient(to top, rgba(11,16,34,0.95), rgba(11,16,34,0.5)), url(${work.bannerImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <p className="text-[0.7rem] uppercase tracking-[0.3em] text-vermillion">{work.type}</p>
        <h1 className="mt-1 font-display text-3xl text-ink">{titleOf(work)}</h1>
        {work.title.native ? <p className="text-ink-muted">{work.title.native}</p> : null}
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
          <p className="mt-3 text-sm text-ink-muted">{work.genres.join(' · ')}</p>
        ) : null}
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
            className="mt-4 w-full rounded-[10px] border border-hairline bg-night-2/70 px-3 py-2 text-sm text-ink outline-none focus:border-vermillion"
          />
          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="primary"
              onClick={() => save.mutate()}
              loading={save.isPending}
              disabled={!dirty}
            >
              Save changes
            </Button>
            {save.isSuccess && !dirty ? (
              <span className="text-sm text-aurora-teal">saved, writeback queued</span>
            ) : null}
          </div>
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
                      style={{ background: PROVIDER_COLOR[s.provider] ?? '#e2542f' }}
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
                    <li key={rel.workId} className="flex items-center justify-between">
                      <span className="text-ink-soft">
                        {rel.displayTitle || 'Related work'}{' '}
                        <span className="text-ink-faint">
                          · {rel.relationType.replace('_', ' ')}
                        </span>
                      </span>
                      <span className="tabular text-xs text-ink-muted">
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
    </div>
  );
}
