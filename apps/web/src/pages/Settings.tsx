import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth, useMotionPref } from '../lib/store';
import { Panel, SectionTitle } from '../components/ui/primitives';
import { Toggle } from '../components/ui/Toggle';
import { Select } from '../components/ui/Select';

export function Settings() {
  const { user, setUser } = useAuth();
  const { reduceMotion, setReduceMotion } = useMotionPref();

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.updateSettings(patch),
    onSuccess: (res) => setUser(res.user),
  });

  if (!user) return null;

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
          onChange={(v) => !user.isDemo && save.mutate({ soundFx: v })}
        />
        <Toggle
          label="Custom cursor"
          description="Replace the pointer with a constellation reticle."
          checked={Boolean(user.settings.customCursor)}
          onChange={(v) => !user.isDemo && save.mutate({ customCursor: v })}
        />
        <div className="mt-4 max-w-xs">
          <Select
            label="Accent"
            value={user.settings.accent}
            onChange={(v) => !user.isDemo && save.mutate({ accent: v })}
            options={[
              { value: 'vermillion', label: 'Vermillion' },
              { value: 'aurora', label: 'Aurora teal' },
              { value: 'gold', label: 'Gold leaf' },
            ]}
          />
        </div>
        {user.isDemo ? (
          <p className="mt-3 text-xs text-ink-faint">
            The demo account cannot save preferences. Motion still toggles locally.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
