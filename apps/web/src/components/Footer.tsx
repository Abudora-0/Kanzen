import { Link } from 'react-router-dom';
import { KanzenMark } from './KanzenMark';
import { Icon } from './Icon';

const REPO = 'https://github.com/Abudora-0/Kanzen';

const PRODUCT = [
  { label: 'Deck', to: '/dashboard' },
  { label: 'Library', to: '/library' },
  { label: 'Insights', to: '/insights' },
  { label: 'Trackers', to: '/connections' },
];
const PROJECT = [
  { label: 'Source on GitHub', href: REPO },
  { label: 'Readme', href: `${REPO}#readme` },
  { label: 'MIT license', href: `${REPO}/blob/main/LICENSE` },
  { label: 'Roadmap', href: `${REPO}#roadmap` },
];
const STACK = ['React', 'Express', 'MongoDB', 'Redis', 'BullMQ', 'Vercel'];

export function Footer({ workspace }: { workspace?: string }) {
  return (
    <footer className="relative z-10 mt-16 border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <KanzenMark variant="full" size={26} />
            <p className="mt-3 max-w-xs text-sm text-ink-muted">
              Every media tracker you use, in one place. Anime, manga, books, and movies, reconciled
              and kept in sync.
            </p>
          </div>

          <FooterCol title="Product">
            {PRODUCT.map((l) => (
              <Link key={l.to} to={l.to} className="footer-link">
                {l.label}
              </Link>
            ))}
          </FooterCol>

          <FooterCol title="Project">
            {PROJECT.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="footer-link inline-flex items-center gap-1"
              >
                {l.label}
                <Icon name="external-link" size={12} className="opacity-60" />
              </a>
            ))}
          </FooterCol>

          <FooterCol title="Built with">
            <div className="flex flex-wrap gap-1.5">
              {STACK.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-hairline px-2 py-0.5 text-[0.7rem] text-ink-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          </FooterCol>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-hairline pt-6 text-xs text-ink-faint sm:flex-row">
          <span>&copy; 2026 Abudora-0 &middot; MIT licensed</span>
          <div className="flex items-center gap-4">
            {workspace ? <span>{workspace}</span> : null}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-1 transition hover:text-ink"
            >
              back to top
              <Icon name="arrow-up" size={13} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-[0.7rem] uppercase tracking-[0.2em] text-ink-faint">{title}</p>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}
