import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadCoachProfile } from '@/constants/coach';
import {
  ensureInviteSettings,
  rotateSignupCode,
  setSignupEnabled,
  type InviteSettings,
} from '@/services/headCoachConfig';
import { listRosterAthletes } from '@/services/users';
import type { UserProfile } from '@/types/models';

export default function RosterPage() {
  const { user, profile, loading } = useAuth();
  const [athletes, setAthletes] = useState<UserProfile[]>([]);
  const [invite, setInvite] = useState<InviteSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  const loadInvite = useCallback(async () => {
    setInvite(await ensureInviteSettings());
  }, []);

  useEffect(() => {
    if (!user || !isHeadCoachProfile(profile, user.email)) return;
    void (async () => {
      setErr(null);
      try {
        const [roster, settings] = await Promise.all([listRosterAthletes(user.uid), ensureInviteSettings()]);
        setAthletes(roster);
        setInvite(settings);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not load roster');
      }
    })();
  }, [user, profile]);

  const copyText = async (text: string, kind: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setErr('Could not copy to clipboard');
    }
  };

  const onRotateCode = async () => {
    if (!window.confirm('Generate a new invite code? Old links will stop working.')) return;
    setInviteBusy(true);
    setErr(null);
    try {
      setInvite(await rotateSignupCode());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not rotate invite code');
    } finally {
      setInviteBusy(false);
    }
  };

  const onToggleSignup = async () => {
    if (!invite) return;
    setInviteBusy(true);
    setErr(null);
    const next = !invite.enabled;
    try {
      await setSignupEnabled(next);
      setInvite({ ...invite, enabled: next });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update sign-ups');
    } finally {
      setInviteBusy(false);
    }
  };

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

      <section className="card stack" aria-labelledby="invite-heading">
        <h2 id="invite-heading" style={{ margin: 0, fontSize: '1rem' }}>
          Invite athletes
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Share the link or code below. New sign-ups need a valid invite to join your roster.
        </p>
        {invite ? (
          <>
            <label className="stack" style={{ gap: '0.25rem' }}>
              <span className="muted">Invite link</span>
              <input readOnly value={invite.inviteUrl} onFocus={(e) => e.target.select()} />
            </label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={inviteBusy || !invite.enabled}
                onClick={() => void copyText(invite.inviteUrl, 'link')}
              >
                {copied === 'link' ? 'Copied!' : 'Copy link'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={inviteBusy}
                onClick={() => void copyText(invite.code, 'code')}
              >
                {copied === 'code' ? 'Copied!' : `Code: ${invite.code}`}
              </button>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <label className="row" style={{ gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={invite.enabled}
                  disabled={inviteBusy}
                  onChange={() => void onToggleSignup()}
                />
                <span className="muted">Allow new sign-ups</span>
              </label>
              <button type="button" className="btn btn-ghost" disabled={inviteBusy} onClick={() => void onRotateCode()}>
                New code
              </button>
            </div>
            {!invite.enabled && (
              <p className="muted" style={{ margin: 0, color: '#fca5a5' }}>
                Sign-ups are paused. Existing athletes can still sign in.
              </p>
            )}
          </>
        ) : (
          <button type="button" className="btn btn-primary" disabled={inviteBusy} onClick={() => void loadInvite()}>
            Set up invites
          </button>
        )}
      </section>

      <p className="muted" style={{ margin: 0 }}>
        Athletes on your roster ({athletes.length}).
      </p>
      {err && <p style={{ color: '#fca5a5', margin: 0 }}>{err}</p>}
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
        <p className="muted">No athletes yet. Share your invite link to add people to the program.</p>
      )}
    </div>
  );
}
