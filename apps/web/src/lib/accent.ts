import { useEffect } from 'react';
import { useAuth } from './store';

const ACCENTS = new Set(['vermillion', 'aurora', 'gold']);

/**
 * Mirrors the signed-in user's accent choice onto `:root[data-accent]`, which
 * `theme.css` uses to swap the vermillion role tokens every accent utility
 * reads from. Defaults to vermillion (no attribute) when nothing is set.
 */
export function useAccent() {
  const accent = useAuth((s) => s.user?.settings.accent);

  useEffect(() => {
    const root = document.documentElement;
    if (accent && ACCENTS.has(accent) && accent !== 'vermillion') {
      root.dataset.accent = accent;
    } else {
      delete root.dataset.accent;
    }
  }, [accent]);
}
