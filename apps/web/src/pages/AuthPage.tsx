import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/store';
import { KanzenMark } from '../components/KanzenMark';
import { Button } from '../components/ui/primitives';

export function AuthPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setUser = useAuth((s) => s.setUser);
  const existing = useAuth((s) => s.user);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) navigate('/dashboard', { replace: true });
  }, [existing, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } =
        mode === 'login'
          ? await api.login({ email: form.email, password: form.password })
          : await api.register(form);
      setUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const enterDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.demo();
      setUser(user);
      navigate('/dashboard');
    } catch {
      setError('Demo account is not available on this deployment yet.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.get('demo') === '1') void enterDemo();
  }, []);

  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="glass w-full max-w-sm p-8">
        <Link to="/" className="mb-6 flex items-center gap-2.5">
          <KanzenMark size={30} />
          <span className="font-display text-sm tracking-[0.32em]">KANZEN</span>
        </Link>

        <h1 className="font-display text-2xl text-ink">
          {mode === 'login' ? 'Welcome back' : 'Make an account'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {mode === 'login' ? 'Your library is where you left it.' : 'Start with an empty sky.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === 'register' ? (
            <Field
              label="Display name"
              value={form.displayName}
              onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
              placeholder="Kanzen Explorer"
            />
          ) : null}
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="name@example.com"
          />
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            placeholder="at least 8 characters"
          />
          {error ? <p className="text-sm text-vermillion-bright">{error}</p> : null}
          <Button type="submit" variant="primary" loading={busy} className="w-full">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            className="text-ink-muted transition hover:text-ink"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Need an account' : 'Have an account'}
          </button>
          <button className="text-aurora-teal transition hover:text-ink" onClick={enterDemo}>
            Enter demo
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
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.7rem] uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-hairline bg-night-2/70 px-3 py-2 text-sm text-ink outline-none transition focus:border-vermillion"
      />
    </label>
  );
}
