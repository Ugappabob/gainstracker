import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadCoachProfile } from '@/constants/coach';
import { listTemplates } from '@/services/library';
import { seedGlobalLibrary } from '@/services/seed';
import { createBlankWorkout, createWorkoutFromTemplate } from '@/services/workouts';
import type { WorkoutTemplate } from '@/types/models';

export default function HomePage() {
  const { user, profile, loading, logOut } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

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
          <Link to="/roster" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            Roster
          </Link>
        )}
      </nav>

      {actionErr && (
        <div className="warning-banner" role="alert">
          {actionErr}
        </div>
      )}

      {isHeadCoachProfile(profile, user.email) && (
        <div className="card stack">
          <h2>Coach</h2>
          <p className="muted" style={{ margin: 0 }}>
            Install default exercises and a starter template (idempotent).
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
              ? 'No templates yet. Use Install starter library above.'
              : 'No templates yet. Ask your coach to install the starter library (coach account only).'}
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
