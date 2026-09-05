import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../lib/store';
import { useTheme, type ThemeChoice } from '../lib/theme';
import { useSyncStream } from '../lib/stream';
import { KanzenMark } from './KanzenMark';
import { Footer } from './Footer';
import { CommandPalette } from './CommandPalette';
import { PageTransition } from './PageTransition';
import { Icon } from './Icon';
import { cn } from '../lib/utils';

const NAV = [
  { to: '/dashboard', label: 'Deck', icon: 'deck' },
  { to: '/library', label: 'Library', icon: 'library' },
  { to: '/insights', label: 'Insights', icon: 'insights' },
  { to: '/connections', label: 'Trackers', icon: 'connections' },
] as const;

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};
const THEME_ICON: Record<ThemeChoice, string> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
};

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pulse = useSyncStream(Boolean(user));
  const { theme, setTheme } = useTheme();
  const routeKey = location.pathname.split('/').slice(0, 3).join('/');
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenuOpen]);

  return (
    <div className="min-h-dvh pb-16 md:pb-0">
      <div className="hairline-grid pointer-events-none fixed inset-0 -z-10" />

      <header className="sticky top-0 z-30 border-b border-hairline bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center"
            aria-label="Kanzen home"
          >
            <KanzenMark variant="full" size={26} syncing={pulse.active} />
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'text-ink' : 'text-ink-muted hover:text-ink-soft',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="font-display tracking-wide">{item.label}</span>
                    {isActive ? (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-vermillion"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.dispatchEvent(new Event('kanzen:palette'))}
              className="hidden items-center gap-2 rounded-md border border-hairline px-2.5 py-1 text-xs text-ink-faint transition hover:border-hairline-bright hover:text-ink-muted lg:flex"
              aria-label="Open command palette"
            >
              <Icon name="search" size={13} />
              <span>Search</span>
              <kbd className="rounded border border-hairline px-1 text-[0.6rem]">Ctrl K</kbd>
            </button>
            <button
              onClick={() => setTheme(THEME_NEXT[theme])}
              aria-label={`Colour theme: ${theme}. Switch to ${THEME_NEXT[theme]}`}
              title={`Theme: ${theme}`}
              className="grid h-9 w-9 place-items-center rounded-md border border-hairline text-ink-soft transition hover:border-hairline-bright md:h-8 md:w-8"
            >
              <Icon name={THEME_ICON[theme]} size={16} />
            </button>
            {pulse.active ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-aurora-teal/40 bg-aurora-teal/10 px-2 py-0.5 text-[0.7rem] text-aurora-teal sm:inline-flex">
                <span className="km-spinner h-2.5 w-2.5" aria-hidden />
                syncing
              </span>
            ) : null}
            <div className="relative hidden md:block" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition',
                  userMenuOpen
                    ? 'border-hairline-bright bg-surface text-ink'
                    : 'border-transparent text-ink-muted hover:border-hairline hover:text-ink',
                )}
              >
                {user?.displayName?.split(' ')[0] ?? 'You'}
                <Icon
                  name="chevron-down"
                  size={13}
                  className={cn('transition-transform', userMenuOpen && 'rotate-180')}
                />
              </button>
              <AnimatePresence>
                {userMenuOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                    role="menu"
                    className="glass absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden p-1.5"
                  >
                    <p className="truncate px-2.5 py-1.5 text-xs text-ink-faint">
                      {user?.isDemo ? 'demo workspace' : user?.email}
                    </p>
                    <NavLink
                      to="/settings"
                      role="menuitem"
                      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-ink-soft transition hover:bg-surface-2 hover:text-ink"
                    >
                      <Icon name="settings" size={16} /> Settings
                    </NavLink>
                    <button
                      role="menuitem"
                      onClick={async () => {
                        await logout();
                        navigate('/');
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink-muted transition hover:bg-vermillion/10 hover:text-vermillion"
                    >
                      <Icon name="external-link" size={16} /> Sign out
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              className="grid h-9 w-9 place-items-center rounded-md border border-hairline text-ink-soft md:hidden"
            >
              <Icon name={menuOpen ? 'x' : 'menu'} size={18} />
            </button>
          </div>
        </div>
        {pulse.active ? (
          <motion.div
            layout
            className="h-0.5 bg-gradient-to-r from-aurora-teal via-aurora-violet to-vermillion"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            style={{ transformOrigin: 'left' }}
          />
        ) : null}
      </header>

      {/* mobile slide-over */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-void/60 md:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="absolute right-0 top-0 h-full w-64 border-l border-hairline bg-night-2 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-ink">{user?.displayName}</p>
              <p className="mb-5 text-xs text-ink-faint">
                {user?.isDemo ? 'demo workspace' : user?.email}
              </p>
              <NavLink
                to="/settings"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-ink-soft hover:bg-surface"
              >
                <Icon name="settings" size={16} /> Settings
              </NavLink>
              <button
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-ink-muted hover:bg-surface"
              >
                <Icon name="external-link" size={16} /> Sign out
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-9">
        <PageTransition id={routeKey}>
          <Outlet context={pulse} />
        </PageTransition>
      </main>

      <Footer workspace={user?.isDemo ? 'demo workspace' : 'your workspace'} />

      <CommandPalette />

      {/* mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-night/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem] transition-colors',
                  isActive ? 'text-vermillion' : 'text-ink-muted',
                )
              }
            >
              <Icon name={item.icon} size={19} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
