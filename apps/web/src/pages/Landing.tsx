import { Link } from 'react-router-dom';
import type { MediaType } from '@kanzen/shared';
import { KanzenMark } from '../components/KanzenMark';
import { Footer } from '../components/Footer';
import { CoverImage } from '../components/CoverImage';
import { useInViewReveal } from '../lib/motion';
import { useAuth } from '../lib/store';

const FEATURES = [
  {
    title: 'Every tracker, one library',
    body: 'Connect AniList, MyAnimeList, Kitsu, and TMDB. Kanzen folds them into a single shelf and keeps every status in step.',
    tone: 'anime',
  },
  {
    title: 'Drift, caught and shown',
    body: 'When two platforms disagree on where you are, Kanzen flags it, resolves it in one click, and writes the fix back.',
    tone: 'manga',
  },
  {
    title: 'Insights from real aggregation',
    body: 'A taste fingerprint, completion velocity with a trailing mean, franchise depth by graph traversal, and predicted finish dates.',
    tone: 'book',
  },
  {
    title: 'A sync engine you can watch',
    body: 'Background queues, per provider rate limiting, and a circuit breaker, all visible on a live radar as they run.',
    tone: 'movie',
  },
];

const TONE: Record<string, string> = {
  anime: 'var(--color-media-anime)',
  manga: 'var(--color-media-manga)',
  book: 'var(--color-media-book)',
  movie: 'var(--color-media-movie)',
};

const STRIP: { title: string; type: MediaType }[] = [
  { title: 'Frieren', type: 'anime' },
  { title: 'Vinland Saga', type: 'manga' },
  { title: 'Dune', type: 'book' },
  { title: 'Blade Runner 2049', type: 'movie' },
  { title: 'Berserk', type: 'manga' },
  { title: 'Cowboy Bebop', type: 'anime' },
  { title: 'Arrival', type: 'movie' },
  { title: 'Hyperion', type: 'book' },
];

export function Landing() {
  const { user } = useAuth();

  return (
    <div className="relative overflow-hidden">
      <div className="warm-wash pointer-events-none absolute left-1/2 top-[-16rem] h-[34rem] w-[34rem] -translate-x-1/2" />
      <div className="paper-grain pointer-events-none absolute inset-0 opacity-60" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <KanzenMark variant="full" size={30} replayOnHover />
        <Link
          to={user ? '/dashboard' : '/enter'}
          className="rounded-[12px] border border-hairline-bright px-4 py-1.5 text-sm text-ink transition hover:border-vermillion"
        >
          {user ? 'Open deck' : 'Sign in'}
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-14 text-center">
        <div className="mx-auto mb-9 w-fit">
          <KanzenMark size={104} replayOnHover />
        </div>
        <p className="mb-4 text-[0.72rem] uppercase tracking-[0.34em] text-vermillion">
          track all your trackers in one place
        </p>
        <h1 className="font-display text-4xl leading-[1.08] text-ink sm:text-6xl">
          One shelf for everything
          <br />
          you <span className="ink-emphasis">watch and read</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-ink-soft">
          Kanzen connects the tracking accounts you already use, merges them into one canonical
          library, reconciles the differences, and turns the whole thing into a living picture of
          your taste.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/enter"
            className="rounded-[12px] bg-vermillion px-6 py-3 text-sm font-medium text-white shadow-card transition hover:bg-vermillion-bright"
          >
            Start tracking
          </Link>
          <Link
            to="/enter?demo=1"
            className="rounded-[12px] border border-hairline-bright px-6 py-3 text-sm text-ink transition hover:border-sage"
          >
            Explore the demo
          </Link>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl overflow-hidden px-5 pb-20">
        <div className="flex gap-3 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          {STRIP.map((s) => (
            <CoverImage
              key={s.title}
              alt={s.title}
              type={s.type}
              className="aspect-[2/3] w-24 shrink-0 sm:w-28"
            />
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-5xl gap-4 px-5 pb-20 sm:grid-cols-2">
        {FEATURES.map((f, i) => (
          <FeatureCard key={f.title} f={f} delay={i * 90} />
        ))}
      </section>

      <Footer />
    </div>
  );
}

function FeatureCard({
  f,
  delay,
}: {
  f: { title: string; body: string; tone: string };
  delay: number;
}) {
  const reveal = useInViewReveal<HTMLDivElement>(delay);
  return (
    <div ref={reveal.ref} className={`glass glass-hover p-6 ${reveal.className}`}>
      <span className="mb-3 block h-1 w-10 rounded-full" style={{ background: TONE[f.tone] }} />
      <h3 className="mb-2 font-display text-lg text-ink">{f.title}</h3>
      <p className="text-sm text-ink-muted">{f.body}</p>
    </div>
  );
}
