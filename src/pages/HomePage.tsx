import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadCoachProfile } from '@/constants/coach';
import { listTemplates } from '@/services/library';
import { seedGlobalLibrary } from '@/services/seed';
import { createBlankWorkout, createWorkoutFromPrevious, createWorkoutFromTemplate, listWorkoutsPage } from '@/services/workouts';
import type { Workout, WorkoutTemplate } from '@/types/models';
import { formatWorkoutDate } from '@/utils/formatWorkoutDate';

export default function HomePage() {
  const { user, profile, loading, logOut, updateDisplayName } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [recentLoadErr, setRecentLoadErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '');
  }, [profile?.displayName]);

  const refreshTemplates = useCallback(async () => {
    if (!user) return;
    setLoadErr(null);
    try {
      const t = await listTemplates();
      setTemplates(t);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load templates');
    }
  }, [user]);

  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

  const refreshRecentWorkouts = useCallback(async () => {
    if (!user) return;
    setRecentLoadErr(null);
    try {
      const page = await listWorkoutsPage(user.uid, { pageSize: 40 });
      setRecentWorkouts(page.workouts.filter((w) => w.status === 'completed').slice(0, 20));
    } catch (e) {
      setRecentLoadErr(e instanceof Error ? e.message : 'Could not load recent workouts');
      setRecentWorkouts([]);
    }
  }, [user]);

  useEffect(() => {
    void refreshRecentWorkouts();
  }, [refreshRecentWorkouts]);

  const startBlank = async () => {
    if (!user) return;
    setActionErr(null);
    setBusy('start');
    try {
      const id = await createBlankWorkout(user.uid);
      navigate(`/workout/${id}`);
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Could not start a session. Check connection and sign-in.');
    } finally {
      setBusy(null);
    }
  };

  const startTemplate = async (tpl: WorkoutTemplate) => {
    if (!user) return;
    setActionErr(null);
    setBusy(tpl.id);
    try {
      const lines = tpl.lines.map((line, i) => ({
        exerciseId: line.exerciseId,
        exerciseName: line.exerciseName,
        order: i,
        sets: line.defaultSets.map((s) => ({ ...s })),
      }));
      const id = await createWorkoutFromTemplate(user.uid, tpl.id, lines);
      navigate(`/workout/${id}`);
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Could not start from template.');
    } finally {
      setBusy(null);
    }
  };

  const repeatWorkout = async (workoutId: string) => {
    if (!user) return;
    setActionErr(null);
    setBusy(`repeat-${workoutId}`);
    try {
      const id = await createWorkoutFromPrevious(user.uid, workoutId);
      navigate(`/workout/${id}`);
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Could not repeat that workout.');
    } finally {
      setBusy(null);
    }
  };

  const saveDisplayName = async () => {
    setProfileBusy(true);
    setProfileMsg(null);
    setActionErr(null);
    try {
      await updateDisplayName(displayName);
      setProfileMsg('Display name saved.');
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'Could not save display name.');
    } finally {
      setProfileBusy(false);
    }
  };

  const installLibrary = async () => {
    setActionErr(null);
    setBusy('seed');
    try {
      await seedGlobalLibrary();
      await refreshTemplates();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Install failed.';
      setActionErr(
        msg.includes('permission') || msg.includes('Permission')
          ? 'Permission denied — only a coach account can install the library.'
          : msg,
      );
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="layout">
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="layout stack">
        <h1>Gainstracker</h1>
        <p className="muted">Sign in to log sessions and view trends.</p>
        <Link className="btn btn-primary" to="/login" style={{ textAlign: 'center', textDecoration: 'none' }}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="layout stack">
      <header className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <h1>Home</h1>
          <p className="muted" style={{ margin: 0 }}>
            {profile?.displayName && <strong>{profile.displayName}</strong>}
            {profile?.displayName && profile?.email ? ' · ' : null}
            {profile?.email ?? user.email} · {profile?.role ?? '…'}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void logOut()}>
          Sign out
        </button>
      </header>

      <nav className="row" style={{ flexWrap: 'wrap' }}>
        <Link to="/history" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          History
        </Link>
        <Link to="/trends" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          Trends
        </Link>
        {isHeadCoachProfile(profile, user.email) && (
          <>
            <Link to="/roster" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              Roster
            </Link>
            <Link to="/templates" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              Templates
            </Link>
          </>
        )}
      </nav>

      {actionErr && (
        <div className="warning-banner" role="alert">
          {actionErr}
        </div>
      )}

      <div className="card stack">
        <h2>Profile</h2>
        <p className="muted" style={{ margin: 0 }}>
          Your coach sees this name on the roster.
        </p>
        <label className="stack" style={{ gap: '0.25rem' }}>
          <span className="muted">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Alex"
            maxLength={80}
            autoComplete="name"
          />
        </label>
        {profileMsg && <p style={{ color: '#86efac', margin: 0 }}>{profileMsg}</p>}
        <button type="button" className="btn btn-primary" disabled={profileBusy} onClick={() => void saveDisplayName()}>
          {profileBusy ? 'Saving…' : 'Save name'}
        </button>
      </div>

      {isHeadCoachProfile(profile, user.email) && (
        <div className="card stack">
          <h2>Coach</h2>
          <p className="muted" style={{ margin: 0 }}>
            Install starter exercises, or manage templates and the library under Templates.
          </p>
          <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void installLibrary()}>
            {busy === 'seed' ? 'Installing…' : 'Install starter library'}
          </button>
        </div>
      )}

      <div className="card stack">
        <h2>Start workout</h2>
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void startBlank()}>
          {busy === 'start' ? 'Starting…' : 'Blank workout'}
        </button>
      </div>

      <div className="card stack">
        <h2>Repeat a workout</h2>
        <p className="muted" style={{ margin: 0 }}>
          Same exercises, sets, and weights as a past session — reps start blank for you to fill in.
        </p>
        {recentLoadErr && <p style={{ color: '#fca5a5', margin: 0 }}>{recentLoadErr}</p>}
        {!recentLoadErr && recentWorkouts.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            No completed workouts yet. Finish a session first, or check History.
          </p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
          {recentWorkouts.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', textAlign: 'left' }}
                disabled={busy !== null}
                onClick={() => void repeatWorkout(w.id)}
              >
                {busy === `repeat-${w.id}` ? 'Starting…' : formatWorkoutDate(w)}
                {w.location ? ` · ${w.location}` : ''}
              </button>
            </li>
          ))}
        </ul>
        <Link to="/history" className="muted" style={{ fontSize: '0.875rem' }}>
          View all history
        </Link>
      </div>

      <div className="card stack">
        <h2>Preset templates</h2>
        {loadErr && (
          <div className="stack" style={{ gap: '0.5rem' }}>
            <p style={{ color: '#fca5a5', margin: 0 }}>{loadErr}</p>
            <button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={() => void refreshTemplates()}>
              Retry
            </button>
          </div>
        )}
        {!loadErr && templates.length === 0 && (
          <p className="muted">
            {isHeadCoachProfile(profile, user.email)
              ? 'No templates yet. Open Templates to create one, or install the starter library.'
              : 'No templates yet. Ask your coach to add workout templates.'}
          </p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', textAlign: 'left' }}
                disabled={busy !== null}
                onClick={() => void startTemplate(t)}
              >
                {busy === t.id ? 'Starting…' : t.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
