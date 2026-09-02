import { useEffect } from 'react';
import { useAuth } from './store';

let enabled = false;
let ctx: AudioContext | null = null;

function tone(freq: number, ms: number, gain: number) {
  if (!enabled) return;
  try {
    ctx ||= new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* audio is a nicety, never a failure */
  }
}

export const sound = {
  tap: () => tone(320, 90, 0.04),
  toggle: () => tone(480, 70, 0.05),
};

/** Delegated click sound for anything tagged as a control. Wired once from App. */
export function useInterfaceSounds() {
  const on = useAuth((s) => Boolean(s.user?.settings.soundFx));

  useEffect(() => {
    enabled = on;
    if (!on) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest(
        'button, a, [role="button"], input[type="checkbox"]',
      );
      if (el) sound.tap();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [on]);
}
