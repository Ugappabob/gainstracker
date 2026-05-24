import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeInviteCode } from '@/utils/inviteCode';

type Mode = 'signin' | 'signup' | 'reset';

export default function LoginPage() {
  const { user, signIn, signUp, resetPassword, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const invite = searchParams.get('invite');
    if (invite) {
      setInviteCode(normalizeInviteCode(invite));
      setMode('signup');
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="layout">
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else if (mode === 'signup') await signUp(email.trim(), password, inviteCode);
      else {
        await resetPassword(email.trim());
        setInfo('Password reset email sent. Check your inbox (and spam).');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="layout stack">
      <h1>Gainstracker</h1>
      <p className="muted">Log at the gym, sync when you are back online.</p>
      {mode !== 'reset' && (
        <div className="row" style={{ gap: '0.25rem' }}>
          <button
            type="button"
            className={`btn ${mode === 'signin' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setMode('signin');
              setError(null);
              setInfo(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`btn ${mode === 'signup' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setMode('signup');
              setError(null);
              setInfo(null);
            }}
          >
            Sign up
          </button>
        </div>
      )}
      <form className="card stack" onSubmit={onSubmit}>
        {mode === 'signup' && (
          <label className="stack" style={{ gap: '0.25rem' }}>
            <span className="muted">Invite code</span>
            <input
              autoComplete="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(normalizeInviteCode(e.target.value))}
              required
              placeholder="From your coach"
              spellCheck={false}
            />
          </label>
        )}
        <label className="stack" style={{ gap: '0.25rem' }}>
          <span className="muted">Email</span>
          <input autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode !== 'reset' && (
          <label className="stack" style={{ gap: '0.25rem' }}>
            <span className="muted">Password</span>
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
        )}
        {error && <p style={{ color: '#fca5a5', margin: 0 }}>{error}</p>}
        {info && <p style={{ color: '#86efac', margin: 0 }}>{info}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy
            ? 'Please wait…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : 'Send reset email'}
        </button>
        {mode === 'signin' && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: '0.25rem' }}
            onClick={() => {
              setMode('reset');
              setError(null);
              setInfo(null);
            }}
          >
            Forgot password?
          </button>
        )}
        {mode === 'reset' && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setMode('signin');
              setError(null);
              setInfo(null);
            }}
          >
            Back to sign in
          </button>
        )}
      </form>
      <p className="muted" style={{ margin: 0 }}>
        {mode === 'signup' ? (
          <>
            New accounts need an <strong>invite code</strong> from your coach and join as athletes on their roster.
          </>
        ) : mode === 'reset' ? (
          <>We&apos;ll email a link to reset your password.</>
        ) : (
          <>Sign in with the email and password you used when invited.</>
        )}
      </p>
      <Link to="/" className="muted">
        Home
      </Link>
    </div>
  );
}
