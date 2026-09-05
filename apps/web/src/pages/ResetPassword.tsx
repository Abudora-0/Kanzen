import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { KanzenMark } from '../components/KanzenMark';
import { Button } from '../components/ui/primitives';

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('This reset link is missing its token.');
      return;
    }
    if (password.length < 8) {
      setError('At least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex w-fit items-center">
          <KanzenMark variant="full" size={28} />
        </Link>

        <h1 className="font-display text-2xl text-ink">Set a new password</h1>

        {done ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-md border border-aurora-teal/30 bg-aurora-teal/10 px-3 py-2 text-sm text-aurora-teal">
              Your password has been reset. Sign in with it below.
            </p>
            <Button variant="primary" className="w-full" onClick={() => navigate('/enter')}>
              Go to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3.5">
            <label className="block">
              <span className="mb-1 block text-[0.7rem] uppercase tracking-[0.18em] text-ink-muted">
                New password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="at least 8 characters"
                className="w-full rounded-[10px] border border-hairline bg-surface/70 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-vermillion focus:ring-2 focus:ring-vermillion/25"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[0.7rem] uppercase tracking-[0.18em] text-ink-muted">
                Confirm password
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="repeat your new password"
                className="w-full rounded-[10px] border border-hairline bg-surface/70 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-vermillion focus:ring-2 focus:ring-vermillion/25"
              />
            </label>

            {error ? (
              <p className="rounded-md border border-vermillion/30 bg-vermillion/10 px-3 py-2 text-sm text-vermillion-bright">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" loading={busy} className="w-full">
              Reset password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
