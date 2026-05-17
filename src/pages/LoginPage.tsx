import { type FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
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
      <div className="row" style={{ gap: '0.25rem' }}>
        <button
          type="button"
          className={`btn ${mode === 'signin' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`btn ${mode === 'signup' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setMode('signup')}
        >
          Sign up
        </button>
      </div>
      <form className="card stack" onSubmit={onSubmit}>
        <label className="stack" style={{ gap: '0.25rem' }}>
          <span className="muted">Email</span>
          <input autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
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
        {error && <p style={{ color: '#fca5a5', margin: 0 }}>{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="muted" style={{ margin: 0 }}>
        New accounts join as <strong>athletes</strong> on your coach&apos;s roster automatically. Coach access is only
        for <strong>stevenfhulett@gmail.com</strong>.
      </p>
      <Link to="/" className="muted">
        Home
      </Link>
    </div>
  );
}
