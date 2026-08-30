import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/store';
import { useSyncStream } from '../lib/stream';
import { KanzenMark } from './KanzenMark';
import { cn } from '../lib/utils';

const NAV = [
  { to: '/dashboard', label: 'Deck' },
  { to: '/library', label: 'Library' },
  { to: '/insights', label: 'Insights' },
  { to: '/connections', label: 'Connections' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pulse = useSyncStream(Boolean(user));

  return (
    <div className="min-h-dvh">
      <div className="hairline-grid pointer-events-none fixed inset-0 -z-10" />
      <header className="sticky top-0 z-30 border-b border-hairline bg-night/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2.5"
            aria-label="Kanzen home"
          >
            <KanzenMark size={30} syncing={pulse.active} />
            <span className="font-display text-sm tracking-[0.32em] text-ink">KANZEN</span>
          </button>

          <nav className="flex items-center gap-1">
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
            <NavLink
              to="/settings"
              className="text-sm text-ink-muted transition hover:text-ink"
              aria-label="Settings"
            >
              {user?.displayName?.split(' ')[0] ?? 'You'}
            </NavLink>
            <button
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="text-xs text-ink-faint transition hover:text-vermillion"
            >
              sign out
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

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet context={pulse} />
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-center text-xs text-ink-faint">
        Kanzen · unified media tracker · {user?.isDemo ? 'demo workspace' : 'your workspace'}
      </footer>
    </div>
  );
}
