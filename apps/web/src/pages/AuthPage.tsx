import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/store';
import { KanzenMark } from '../components/KanzenMark';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui/primitives';

const LINES = [
  'One canonical library from every platform you connect.',
  'Cross-platform drift, surfaced and resolved in a click.',
  'Insights from real MongoDB aggregation, not a spreadsheet.',
  'A background sync engine you can actually watch run.',
];

export function AuthPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setUser = useAuth((s) => s.setUser);
  const existing = useAuth((s) => s.user);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'form' | 'demo' | null>(null);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (existing) navigate('/dashboard', { replace: true });
  }, [existing, navigate]);

  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % LINES.length), 4200);
    return () => clearInterval(t);
  }, []);

  const emailBad = touched.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);
  const pwBad = touched.password && form.password.length > 0 && form.password.length < 8;
  const nameBad = mode === 'register' && touched.displayName && form.displayName.trim().length < 1;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true, displayName: true });
    if (
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) ||
      form.password.length < (mode === 'register' ? 8 : 1) ||
      (mode === 'register' && !form.displayName.trim())
    )
      return;
    setBusy('form');
    setError(null);
    try {
      const { user } =
        mode === 'login'
          ? await api.login({ email: form.email, password: form.password, rememberMe })
          : await api.register(form);
      setUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const enterDemo = async () => {
    setBusy('demo');
    setError(null);
    try {
      const { user } = await api.demo();
      setUser(user);
      navigate('/dashboard');
    } catch {
      setError('The demo account is not seeded on this deployment yet.');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (params.get('demo') === '1') void enterDemo();
  }, []);

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden overflow-hidden border-r border-hairline bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="paper-grain pointer-events-none absolute inset-0 opacity-70" />
        <div className="warm-wash pointer-events-none absolute -left-24 -top-24 h-96 w-96" />

        <Link to="/" className="relative z-10 w-fit">
          <KanzenMark variant="full" size={30} replayOnHover />
        </Link>

        <div className="relative z-10">
          <h2 className="font-display text-4xl leading-tight text-ink">
            One shelf for everything
            <br />
            <span className="ink-emphasis">you watch and read.</span>
          </h2>
          <div className="mt-6 h-12">
            <AnimatePresence mode="wait">
              <motion.p
                key={line}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="max-w-sm text-sm text-ink-soft"
              >
                {LINES[line]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <p className="relative z-10 font-display text-sm text-ink-faint">
          every media tracker you use, in one place
        </p>
      </div>

      {/* form panel */}
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex w-fit items-center lg:hidden">
            <KanzenMark variant="full" size={28} />
          </Link>

          <h1 className="font-display text-2xl text-ink">
            {mode === 'login' ? 'Welcome back' : 'Make an account'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {mode === 'login'
              ? 'Your library is where you left it.'
              : 'Make an account, then connect your first tracker.'}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3.5">
            {mode === 'register' ? (
              <Field
                label="Display name"
                value={form.displayName}
                onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
                onBlur={() => setTouched((t) => ({ ...t, displayName: true }))}
                placeholder="Kanzen Explorer"
                error={nameBad ? 'Enter a name' : undefined}
              />
            ) : null}
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="name@example.com"
              error={emailBad ? 'Enter a valid email' : undefined}
            />
            <Field
              label="Password"
              type={showPw ? 'text' : 'password'}
              value={form.password}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              placeholder={mode === 'register' ? 'at least 8 characters' : 'your password'}
              error={pwBad ? 'At least 8 characters' : undefined}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="text-ink-faint transition hover:text-ink"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPw ? 'eye-off' : 'eye'} size={16} />
                </button>
              }
            />

            {mode === 'login' ? (
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-hairline accent-vermillion"
                />
                Remember me
              </label>
            ) : null}

            {error ? (
              <p className="rounded-md border border-vermillion/30 bg-vermillion/10 px-3 py-2 text-sm text-vermillion-bright">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" loading={busy === 'form'} className="w-full">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[0.7rem] uppercase tracking-widest text-ink-faint">
            <span className="h-px flex-1 bg-hairline" />
            or
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <Button variant="ghost" onClick={enterDemo} loading={busy === 'demo'} className="w-full">
            Explore the demo
          </Button>

          <button
            className="mt-5 w-full text-center text-sm text-ink-muted transition hover:text-ink"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  error,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  error?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.7rem] uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </span>
      <span className="relative flex items-center">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`w-full rounded-[10px] border bg-surface/70 px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-vermillion focus:ring-2 focus:ring-vermillion/25 ${
            error ? 'border-vermillion/60' : 'border-hairline'
          } ${trailing ? 'pr-10' : ''}`}
        />
        {trailing ? <span className="absolute right-3">{trailing}</span> : null}
      </span>
      {error ? <span className="mt-1 block text-xs text-vermillion-bright">{error}</span> : null}
    </label>
  );
}
