import { useEffect } from 'react';
import { create } from 'zustand';

export type ThemeChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'kanzen:theme';
const PAGE_DARK = '#15120d';
const PAGE_LIGHT = '#f5eee0';

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* private mode / disabled storage */
  }
  return 'system';
}

export function resolvedTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'system') return mq?.matches ? 'dark' : 'light';
  return choice;
}

/** Idempotent: writes data-theme, color-scheme, and the theme-color meta. */
export function applyTheme(choice: ThemeChoice) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const effective = resolvedTheme(choice);
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  root.style.colorScheme = effective;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', effective === 'dark' ? PAGE_DARK : PAGE_LIGHT);
}

type ThemeState = {
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
};

export const useTheme = create<ThemeState>((set) => ({
  theme: readStored(),
  setTheme: (t) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    applyTheme(t);
    set({ theme: t });
  },
}));

// Follow the OS while the choice is 'system'.
mq?.addEventListener('change', () => {
  if (useTheme.getState().theme === 'system') applyTheme('system');
});

/** Re-asserts the theme after hydration (the inline head script sets it first). */
export function useThemeInit() {
  const theme = useTheme((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
}
