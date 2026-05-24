import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadCoachProfile } from '@/constants/coach';
import { exportWorkoutsCsv, formatLastWorkoutLabel } from '@/services/export';
import {
  ensureInviteSettings,
  rotateSignupCode,
  setSignupEnabled,
  type InviteSettings,
} from '@/services/headCoachConfig';
import {
  listRosterAthletesWithActivity,
  removeAthleteFromRoster,
  updateAthleteCoachNotes,
} from '@/services/users';
import type { RosterAthlete } from '@/types/models';

const ONBOARDING_KEY = 'gainstracker-onboarding-v1';

type OnboardingState = {
  github: boolean;
  invite: boolean;
  library: boolean;
  athlete: boolean;
};

function loadOnboarding(): OnboardingState {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return { github: false, invite: false, library: false, athlete: false };
    return { ...{ github: false, invite: false, library: false, athlete: false }, ...JSON.parse(raw) };
  } catch {
    return { github: false, invite: false, library: false, athlete: false };
  }
}

function saveOnboarding(state: OnboardingState) {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
}

function AthleteNotes({
  athleteUid,
  initialNotes,
  onSaved,
}: {
  athleteUid: string;
  initialNotes: string;
  onSaved: (notes: string | null) => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes, athleteUid]);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const trimmed = notes.trim();
      await updateAthleteCoachNotes(athleteUid, trimmed.length > 0 ? trimmed : null);
      onSaved(trimmed.length > 0 ? trimmed : null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save notes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="stack" style={{ gap: '0.25rem' }}>
      <span className="muted">Coach notes (private)</span>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => void save()}
        placeholder="Goals, injuries, program notes…"
      />
      {saving && <span className="muted">Saving…</span>}
      {err && <span style={{ color: '#fca5a5' }}>{err}</span>}
    </label>
  );
}

export default function RosterPage() {
  const { user, profile, loading } = useAuth();
  const [athletes, setAthletes] = useState<RosterAthlete[]>([]);
  const [invite, setInvite] = useState<InviteSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [exportingUid, setExportingUid] = useState<string | null>(null);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState>(() => loadOnboarding());

  const loadInvite = useCallback(async () => {
    setInvite(await ensureInviteSettings());
  }, []);

  useEffect(() => {
    if (!user || !isHeadCoachProfile(profile, user.email)) return;
    void (async () => {
      setErr(null);
      try {
        const [roster, settings] = await Promise.all([
          listRosterAthletesWithActivity(user.uid),
          ensureInviteSettings(),
        ]);
        setAthletes(roster);
        setInvite(settings);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not load roster');
      }
    })();
  }, [user, profile]);

  const toggleOnboarding = (key: keyof OnboardingState) => {
    const next = { ...onboarding, [key]: !onboarding[key] };
    setOnboarding(next);
    saveOnboarding(next);
  };

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

  const onExport = async (a: RosterAthlete) => {
    setExportingUid(a.uid);
    setErr(null);
    try {
      const stem = a.displayName || a.email || a.uid;
      await exportWorkoutsCsv(a.uid, stem);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExportingUid(null);
    }
  };

  const onRemove = async (a: RosterAthlete) => {
    const name = a.displayName || a.email || a.uid;
    if (
      !window.confirm(
        `Remove ${name} from your roster? Their account and workout history stay — they can still sign in, but you will no longer see their data.`,
      )
    ) {
      return;
    }
    setRemovingUid(a.uid);
    setErr(null);
    try {
      await removeAthleteFromRoster(a.uid);
      setAthletes((prev) => prev.filter((x) => x.uid !== a.uid));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not remove athlete');
    } finally {
      setRemovingUid(null);
    }
  };

  const onboardingDone = Object.values(onboarding).every(Boolean);

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

      {!onboardingDone && (
        <section className="card stack" aria-labelledby="onboarding-heading">
          <h2 id="onboarding-heading" style={{ margin: 0, fontSize: '1rem' }}>
            Getting started
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            One-time setup checklist. See <code>docs/ONBOARDING.md</code> in the repo for GitHub + CI steps.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
            {[
              { key: 'github' as const, label: 'Push repo to GitHub (enables CI on every push)' },
              { key: 'invite' as const, label: 'Copy invite link and send to your first athlete' },
              { key: 'library' as const, label: 'Install starter library (Home → Templates or library seed)' },
              { key: 'athlete' as const, label: 'Confirm first athlete appears below' },
            ].map(({ key, label }) => (
              <li key={key}>
                <label className="row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={onboarding[key]} onChange={() => toggleOnboarding(key)} />
                  <span>{label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        Athletes on your roster ({athletes.length}). Sorted by most recent activity.
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
              <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                {formatLastWorkoutLabel(a.lastWorkoutAt)}
              </p>
            </div>
            <AthleteNotes
              athleteUid={a.uid}
              initialNotes={a.coachNotes ?? ''}
              onSaved={(notes) => {
                setAthletes((prev) => prev.map((x) => (x.uid === a.uid ? { ...x, coachNotes: notes } : x)));
              }}
            />
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
              <button
                type="button"
                className="btn btn-ghost"
                disabled={exportingUid !== null || removingUid !== null}
                onClick={() => void onExport(a)}
              >
                {exportingUid === a.uid ? 'Exporting…' : 'Export CSV'}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={exportingUid !== null || removingUid !== null}
                onClick={() => void onRemove(a)}
              >
                {removingUid === a.uid ? '…' : 'Remove'}
              </button>
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
