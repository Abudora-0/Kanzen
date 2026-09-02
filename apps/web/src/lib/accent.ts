import { useEffect } from 'react';
import { coerceAccent } from '@kanzen/shared';
import { useAuth } from './store';

/**
 * Mirrors the signed-in user's accent choice onto `:root[data-accent]`, which
 * `theme.css` uses to swap the rust role tokens every accent utility reads
 * from. 'rust' is the default and carries no attribute.
 */
export function useAccent() {
  const accent = useAuth((s) => s.user?.settings.accent);

  useEffect(() => {
    const root = document.documentElement;
    const resolved = coerceAccent(accent);
    if (resolved === 'rust') delete root.dataset.accent;
    else root.dataset.accent = resolved;
  }, [accent]);
}
