import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import type { MediaType } from '@kanzen/shared';
import { api } from '../lib/api';
import { useMotionPref } from '../lib/store';
import { useToast } from '../lib/toast';
import { Icon } from './Icon';
import { CoverImage } from './CoverImage';
import { titleOf } from '../lib/utils';

type Item = {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
  cover?: { src?: string | null; type: MediaType; alt: string };
  run: () => void;
};

/**
 * Cmd/Ctrl+K palette: jump to any page, run a quick action, or search the
 * library. Also handles the `g d/l/i/c` navigation chords.
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const toast = useToast();
  const { reduceMotion, setReduceMotion } = useMotionPref();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let gPending = 0;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const typing = Boolean(
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable),
      );

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape') setOpen(false);
      if (e.key === '/' && !typing && !mod) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (typing || mod || e.altKey) return;

      if (e.key === 'g') {
        gPending = Date.now();
        return;
      }
      if (gPending && Date.now() - gPending < 900) {
        const to = { d: '/dashboard', l: '/library', i: '/insights', c: '/connections' }[e.key];
        if (to) {
          e.preventDefault();
          navigate(to);
        }
        gPending = 0;
      }
    };
    const openEvent = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('kanzen:palette', openEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('kanzen:palette', openEvent);
    };
  }, [navigate]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  const trimmed = query.trim();
  const results = useQuery({
    queryKey: ['palette-search', trimmed],
    queryFn: () => api.library({ q: trimmed, pageSize: 6, sort: 'updated' }),
    enabled: open && trimmed.length >= 2,
  });

  const items = useMemo<Item[]>(() => {
    const close = () => setOpen(false);
    const nav: Item[] = [
      { id: 'nav-deck', label: 'Deck', icon: 'deck', run: () => (navigate('/dashboard'), close()) },
      {
        id: 'nav-library',
        label: 'Library',
        icon: 'library',
        run: () => (navigate('/library'), close()),
      },
      {
        id: 'nav-insights',
        label: 'Insights',
        icon: 'insights',
        run: () => (navigate('/insights'), close()),
      },
      {
        id: 'nav-connections',
        label: 'Connections',
        icon: 'connections',
        run: () => (navigate('/connections'), close()),
      },
      {
        id: 'nav-settings',
        label: 'Settings',
        icon: 'settings',
        run: () => (navigate('/settings'), close()),
      },
    ];
    const actions: Item[] = [
      {
        id: 'act-sync',
        label: 'Sync all platforms',
        hint: 'action',
        icon: 'spark',
        run: () => {
          api
            .sync({ mode: 'incremental' })
            .then(() => toast.show('Sync started for all platforms'))
            .catch(() => toast.show('Sync could not start', 'error'));
          close();
        },
      },
      {
        id: 'act-motion',
        label: reduceMotion ? 'Turn motion on' : 'Reduce motion',
        hint: 'action',
        icon: 'command',
        run: () => {
          setReduceMotion(!reduceMotion);
          close();
        },
      },
    ];
    const lib: Item[] = (results.data?.items ?? []).map((entry) => ({
      id: `lib-${entry.id}`,
      label: titleOf(entry.work),
      hint: entry.work.type,
      cover: { src: entry.work.coverImage, type: entry.work.type, alt: titleOf(entry.work) },
      run: () => (navigate(`/library/${entry.id}`), close()),
    }));

    const q = trimmed.toLowerCase();
    const filteredNav = q ? nav.filter((n) => n.label.toLowerCase().includes(q)) : nav;
    const filteredActions = q ? actions.filter((a) => a.label.toLowerCase().includes(q)) : actions;
    return [...filteredNav, ...filteredActions, ...lib];
  }, [navigate, toast, reduceMotion, setReduceMotion, results.data, trimmed]);

  useEffect(() => {
    if (active >= items.length) setActive(items.length ? items.length - 1 : 0);
  }, [items.length, active]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.run();
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] flex items-start justify-center bg-void/70 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="glass w-full max-w-lg overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
              <Icon name="search" size={16} className="text-ink-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKey}
                placeholder="Search the library, jump to a page, run an action"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
              <kbd className="hidden rounded border border-hairline px-1.5 py-0.5 text-[0.65rem] text-ink-faint sm:block">
                esc
              </kbd>
            </div>

            <ul className="max-h-[52vh] overflow-y-auto py-1.5">
              {items.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-ink-muted">
                  {results.isFetching ? 'Searching...' : 'No matches'}
                </li>
              ) : (
                items.map((item, i) => (
                  <li key={item.id}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => item.run()}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                        i === active ? 'bg-surface/70 text-ink' : 'text-ink-soft'
                      }`}
                    >
                      {item.cover ? (
                        <CoverImage
                          src={item.cover.src}
                          alt={item.cover.alt}
                          type={item.cover.type}
                          className="h-8 w-6 shrink-0"
                          rounded="rounded"
                        />
                      ) : (
                        <span className="grid h-6 w-6 shrink-0 place-items-center text-ink-muted">
                          <Icon name={item.icon ?? 'chevron-right'} size={16} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint ? (
                        <span className="shrink-0 text-[0.7rem] uppercase tracking-wide text-ink-faint">
                          {item.hint}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
