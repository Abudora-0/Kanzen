import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth, useMotionPref } from '../lib/store';
import { useTheme } from '../lib/theme';
import { Panel, SectionTitle } from '../components/ui/primitives';
import { Toggle } from '../components/ui/Toggle';
import { Select } from '../components/ui/Select';

export function Settings() {
  const { user, setUser } = useAuth();
  const { reduceMotion, setReduceMotion } = useMotionPref();
  const { theme, setTheme } = useTheme();

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.updateSettings(patch),
    onSuccess: (res) => setUser(res.user),
  });

  if (!user) return null;

  // Feel settings apply instantly. For a real account they also persist; the
  // shared demo account keeps them local to this browser session.
  const applyFeel = (patch: Record<string, unknown>) => {
    setUser({ ...user, settings: { ...user.settings, ...patch } });
    if (!user.isDemo) save.mutate(patch);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.3em] text-vermillion">settings</p>
        <h1 className="font-display text-3xl text-ink">Preferences</h1>
      </div>

      <Panel>
        <SectionTitle eyebrow="you">Account</SectionTitle>
        <dl className="space-y-2 text-sm">
          <Row label="Name" value={user.displayName} />
          <Row label="Email" value={user.email} />
          <Row label="Workspace" value={user.isDemo ? 'shared demo (read only)' : 'personal'} />
        </dl>
      </Panel>

      <Panel>
        <SectionTitle eyebrow="feel">Motion and theme</SectionTitle>
        <div className="mb-4 max-w-xs">
          <Select
            label="Theme"
            value={theme}
            onChange={(v) => setTheme(v as 'system' | 'light' | 'dark')}
            options={[
              { value: 'system', label: 'Match system' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <Toggle
          label="Reduce motion"
          description="Freeze the constellation, logo, and counters. Also follows your system setting."
          checked={reduceMotion}
          onChange={(v) => {
            setReduceMotion(v);
            if (!user.isDemo) save.mutate({ reduceMotion: v });
          }}
        />
        <Toggle
          label="Interface sounds"
          description="Soft clicks on controls. Off by default."
          checked={Boolean(user.settings.soundFx)}
          onChange={(v) => applyFeel({ soundFx: v })}
        />
        <Toggle
          label="Custom cursor"
          description="Swap the pointer for a small ring that eases toward what it hovers."
          checked={Boolean(user.settings.customCursor)}
          onChange={(v) => applyFeel({ customCursor: v })}
        />
        <div className="mt-4 max-w-xs">
          <Select
            label="Accent"
            value={user.settings.accent}
            onChange={(v) => applyFeel({ accent: v })}
            options={[
              { value: 'rust', label: 'Rust' },
              { value: 'sage', label: 'Sage' },
              { value: 'gold', label: 'Gold' },
            ]}
          />
        </div>
        {user.isDemo ? (
          <p className="mt-3 text-xs text-ink-faint">
            The demo account cannot save preferences. Changes here apply for this session only.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="truncate text-right text-ink">{value}</dd>
    </div>
  );
}
