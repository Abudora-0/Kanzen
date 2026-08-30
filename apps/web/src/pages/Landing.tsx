import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { KanzenMark } from '../components/KanzenMark';
import { useAuth } from '../lib/store';

const FEATURES = [
  {
    title: 'One library, every platform',
    body: 'Connect AniList, MyAnimeList, Kitsu, and TMDB. Kanzen folds them into a single canonical library and keeps statuses in step.',
    tone: 'teal',
  },
  {
    title: 'A constellation, not a spreadsheet',
    body: 'Your titles become a force directed star map clustered by medium, with franchise chains drawn as edges you can trace.',
    tone: 'violet',
  },
  {
    title: 'Insights from real aggregation',
    body: 'Taste fingerprint, completion velocity with a trailing mean, franchise depth via graph traversal, and predicted finish dates.',
    tone: 'rose',
  },
  {
    title: 'A sync engine you can watch',
    body: 'Background queues, per provider rate limiting, and a circuit breaker, all visible on a live radar as they run.',
    tone: 'accent',
  },
];

const TONE: Record<string, string> = {
  teal: 'var(--color-aurora-teal)',
  violet: 'var(--color-aurora-violet)',
  rose: 'var(--color-aurora-rose)',
  accent: 'var(--color-vermillion)',
};

export function Landing() {
  const { user } = useAuth();
  const { scrollY } = useScroll();
  const glowY = useTransform(scrollY, [0, 500], [0, 120]);

  return (
    <div className="relative overflow-hidden">
      <motion.div
        style={{ y: glowY }}
        className="pointer-events-none absolute left-1/2 top-[-12rem] h-[36rem] w-[36rem] -translate-x-1/2 opacity-60"
      >
        <div className="aurora-orb h-full w-full" />
      </motion.div>
      <div className="hairline-grid pointer-events-none absolute inset-0" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2.5">
          <KanzenMark size={30} replayOnHover />
          <span className="font-display text-sm tracking-[0.34em]">KANZEN</span>
        </div>
        <Link
          to={user ? '/dashboard' : '/enter'}
          className="rounded-[10px] border border-hairline-bright px-4 py-1.5 text-sm text-ink transition hover:border-vermillion"
        >
          {user ? 'Open deck' : 'Sign in'}
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-24 pt-16 text-center">
        <div className="mx-auto mb-10 w-fit">
          <KanzenMark size={120} replayOnHover />
        </div>
        <p className="mb-4 text-[0.75rem] uppercase tracking-[0.4em] text-vermillion">
          unified media tracker
        </p>
        <h1 className="font-display text-4xl leading-tight text-ink sm:text-6xl">
          Every list you keep,
          <br />
          <span className="aurora-text">held as one.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-ink-soft">
          Kanzen aggregates your anime, manga, books, and movies from public APIs, reconciles the
          differences, and turns the whole thing into a living chart of your taste.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/enter"
            className="rounded-[12px] bg-vermillion px-6 py-3 text-sm font-medium text-white shadow-[0_16px_40px_-14px_rgba(226,84,47,0.75)] transition hover:bg-vermillion-bright"
          >
            Start tracking
          </Link>
          <Link
            to="/enter?demo=1"
            className="rounded-[12px] border border-hairline-bright px-6 py-3 text-sm text-ink transition hover:border-aurora-teal"
          >
            Explore the demo
          </Link>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-5xl gap-4 px-5 pb-24 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <article key={f.title} className="glass p-6 transition hover:border-hairline-bright">
            <span
              className="mb-3 block h-1 w-10 rounded-full"
              style={{ background: TONE[f.tone] }}
            />
            <h3 className="mb-2 font-display text-lg text-ink">{f.title}</h3>
            <p className="text-sm text-ink-muted">{f.body}</p>
          </article>
        ))}
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-5 pb-28 text-center">
        <p className="font-display text-2xl text-ink-soft">
          完全 · kanzen · <span className="text-ink">complete</span>
        </p>
        <p className="mt-3 text-sm text-ink-faint">
          Built with React, Express, MongoDB aggregation, BullMQ, and Redis.
        </p>
      </section>
    </div>
  );
}
