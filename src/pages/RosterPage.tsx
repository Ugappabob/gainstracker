import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadCoachProfile } from '@/constants/coach';
import { listRosterAthletes } from '@/services/users';
import type { UserProfile } from '@/types/models';

export default function RosterPage() {
  const { user, profile, loading } = useAuth();
  const [athletes, setAthletes] = useState<UserProfile[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isHeadCoachProfile(profile, user.email)) return;
    void (async () => {
      setErr(null);
      try {
        setAthletes(await listRosterAthletes(user.uid));
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not load roster');
      }
    })();
  }, [user, profile]);

  if (loading) return <div className="layout muted">Loading…</div>;
  if (!user) return <div className="layout muted">Sign in required.</div>;

  if (!isHeadCoachProfile(profile, user.email)) {
    return (
      <div className="layout stack">
        <h1>Roster</h1>
        <p className="muted">Only the head coach can view the athlete roster.</p>
        <Link to="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="layout stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Roster</h1>
        <Link to="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          Home
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Athletes linked to your account ({athletes.length}).
      </p>
      {err && <p style={{ color: '#fca5a5' }}>{err}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
        {athletes.map((a) => (
          <li key={a.uid} className="card stack" style={{ gap: '0.5rem' }}>
            <div>
              <strong>{a.displayName || a.email || a.uid}</strong>
              {a.email && a.displayName && (
                <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                  {a.email}
                </p>
              )}
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Link
                to={`/history?athlete=${encodeURIComponent(a.uid)}`}
                className="btn btn-ghost"
                style={{ textDecoration: 'none' }}
              >
                History
              </Link>
              <Link
                to={`/trends?athlete=${encodeURIComponent(a.uid)}`}
                className="btn btn-ghost"
                style={{ textDecoration: 'none' }}
              >
                Trends
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {athletes.length === 0 && !err && (
        <p className="muted">No athletes yet. They appear here after signing up (linked to you automatically).</p>
      )}
    </div>
  );
}
