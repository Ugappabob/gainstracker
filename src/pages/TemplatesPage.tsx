import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadCoachProfile } from '@/constants/coach';
import ExercisePicker from '@/components/ExercisePicker';
import {
  createExercise,
  defaultTemplateLine,
  deleteExercise,
  deleteTemplate,
  listExercises,
  listTemplates,
  saveTemplate,
  updateExercise,
} from '@/services/library';
import type { Exercise, TemplateLine, WorkoutTemplate } from '@/types/models';

function emptyDraft(): { id?: string; name: string; lines: TemplateLine[] } {
  return { name: '', lines: [] };
}

function TemplateLineEditor({
  line,
  exercises,
  onChange,
  onRemove,
}: {
  line: TemplateLine;
  exercises: Exercise[];
  onChange: (next: TemplateLine) => void;
  onRemove: () => void;
}) {
  const updateSet = (i: number, field: 'reps' | 'weight', raw: string) => {
    const n = raw === '' ? 0 : Number(raw);
    const v = Number.isFinite(n) ? n : 0;
    const nextSets = line.defaultSets.map((s, j) => (j === i ? { ...s, [field]: v } : s));
    onChange({ ...line, defaultSets: nextSets });
  };

  const addSet = () => {
    const last = line.defaultSets[line.defaultSets.length - 1] ?? { reps: 8, weight: 0 };
    onChange({ ...line, defaultSets: [...line.defaultSets, { reps: last.reps, weight: last.weight }] });
  };

  const removeSet = () => {
    if (line.defaultSets.length <= 1) return;
    onChange({ ...line, defaultSets: line.defaultSets.slice(0, -1) });
  };

  const pickExercise = (exerciseId: string, exerciseName: string) => {
    onChange({ ...line, exerciseId, exerciseName });
  };

  return (
    <div className="card stack template-line-editor">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <strong>{line.exerciseName || 'Pick exercise'}</strong>
        <button type="button" className="btn btn-ghost" style={{ padding: '0.35rem 0.5rem' }} onClick={onRemove}>
          Remove
        </button>
      </div>
      <ExercisePicker exercises={exercises} onPick={pickExercise} />
      <p className="muted" style={{ margin: 0 }}>
        Default sets for new workouts from this template
      </p>
      {line.defaultSets.map((s, i) => (
        <div key={i} className="set-row">
          <label className="muted set-field">
            Weight
            <input type="number" value={s.weight || ''} onChange={(e) => updateSet(i, 'weight', e.target.value)} />
          </label>
          <label className="muted set-field">
            Reps
            <input type="number" value={s.reps || ''} onChange={(e) => updateSet(i, 'reps', e.target.value)} />
          </label>
        </div>
      ))}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost" style={{ padding: '0.35rem 0.5rem' }} onClick={addSet}>
          + Set
        </button>
        <button type="button" className="btn btn-ghost" style={{ padding: '0.35rem 0.5rem' }} onClick={removeSet}>
          − Set
        </button>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { user, profile, loading } = useAuth();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [newExerciseName, setNewExerciseName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [t, e] = await Promise.all([listTemplates(), listExercises()]);
    setTemplates(t);
    setExercises(e);
  }, []);

  useEffect(() => {
    if (!user || !isHeadCoachProfile(profile, user.email)) return;
    void reload().catch((e) => setErr(e instanceof Error ? e.message : 'Load failed'));
  }, [user, profile, reload]);

  const selectTemplate = (tpl: WorkoutTemplate) => {
    setDraft({
      id: tpl.id,
      name: tpl.name,
      lines: tpl.lines.map((l) => ({
        ...l,
        defaultSets: l.defaultSets.map((s) => ({ ...s })),
      })),
    });
    setErr(null);
    setMsg(null);
  };

  const startNew = () => {
    setDraft(emptyDraft());
    setErr(null);
    setMsg(null);
  };

  const saveDraft = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const id = await saveTemplate(draft);
      setMsg('Template saved.');
      await reload();
      setDraft((d) => ({ ...d, id }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const removeDraft = async () => {
    if (!draft.id) {
      startNew();
      return;
    }
    if (!window.confirm(`Delete template "${draft.name}"?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteTemplate(draft.id);
      setMsg('Template deleted.');
      startNew();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const addLineFromLibrary = (exerciseId: string, exerciseName: string) => {
    setDraft((d) => ({
      ...d,
      lines: [...d.lines, defaultTemplateLine({ id: exerciseId, name: exerciseName })],
    }));
  };

  const addLibraryExercise = async () => {
    const name = newExerciseName.trim();
    if (!name) return;
    setBusy(true);
    setErr(null);
    try {
      await createExercise(name);
      setNewExerciseName('');
      await reload();
      setMsg(`Added "${name}" to library.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add exercise');
    } finally {
      setBusy(false);
    }
  };

  const renameExercise = async (ex: Exercise, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === ex.name) return;
    setBusy(true);
    setErr(null);
    try {
      await updateExercise(ex.id, trimmed);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not rename exercise');
    } finally {
      setBusy(false);
    }
  };

  const removeExercise = async (ex: Exercise) => {
    if (!window.confirm(`Remove "${ex.name}" from the library? Templates using it keep the old id.`)) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteExercise(ex.id);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not delete exercise');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="layout muted">Loading…</div>;
  if (!user) return <div className="layout muted">Sign in required.</div>;

  if (!isHeadCoachProfile(profile, user.email)) {
    return (
      <div className="layout stack">
        <h1>Templates</h1>
        <p className="muted">Only the coach can edit workout templates and the exercise library.</p>
        <Link to="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="layout stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Templates &amp; library</h1>
        <Link to="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          Home
        </Link>
      </div>

      {err && <p style={{ color: '#fca5a5', margin: 0 }}>{err}</p>}
      {msg && <p style={{ color: '#86efac', margin: 0 }}>{msg}</p>}

      <section className="card stack">
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Workout templates</h2>
        <p className="muted" style={{ margin: 0 }}>
          Athletes start sessions from these presets on Home.
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={startNew}>
            New template
          </button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={`btn btn-ghost${draft.id === t.id ? ' template-selected' : ''}`}
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => selectTemplate(t)}
              >
                {t.name}
                <span className="muted" style={{ marginLeft: '0.35rem', fontSize: '0.8125rem' }}>
                  ({t.lines.length} exercises)
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0, fontSize: '1rem' }}>{draft.id ? 'Edit template' : 'New template'}</h2>
        <label className="stack" style={{ gap: '0.25rem' }}>
          <span className="muted">Template name</span>
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Lower A" />
        </label>

        <div className="stack">
          <span className="muted">Exercises in template</span>
          {draft.lines.map((line, i) => (
            <TemplateLineEditor
              key={`${line.exerciseId}-${i}`}
              line={line}
              exercises={exercises}
              onChange={(next) =>
                setDraft((d) => ({
                  ...d,
                  lines: d.lines.map((l, j) => (j === i ? next : l)),
                }))
              }
              onRemove={() => setDraft((d) => ({ ...d, lines: d.lines.filter((_, j) => j !== i) }))}
            />
          ))}
          {draft.lines.length === 0 && <p className="muted" style={{ margin: 0 }}>Add exercises below.</p>}
        </div>

        <div className="stack">
          <span className="muted">Add exercise to template</span>
          <ExercisePicker exercises={exercises} disabled={busy} onPick={addLineFromLibrary} />
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveDraft()}>
            {busy ? 'Saving…' : 'Save template'}
          </button>
          {(draft.id || draft.name || draft.lines.length > 0) && (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void removeDraft()}>
              {draft.id ? 'Delete template' : 'Clear'}
            </button>
          )}
        </div>
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Exercise library</h2>
        <p className="muted" style={{ margin: 0 }}>
          Shared names athletes pick when logging. Custom names still work for one-offs.
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
          <label className="stack" style={{ flex: 1, minWidth: '10rem', gap: '0.25rem' }}>
            <span className="muted">New exercise</span>
            <input
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              placeholder="e.g. Incline bench"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addLibraryExercise();
                }
              }}
            />
          </label>
          <button type="button" className="btn btn-primary" disabled={busy || !newExerciseName.trim()} onClick={() => void addLibraryExercise()}>
            Add
          </button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
          {exercises.map((ex) => (
            <li key={ex.id} className="row exercise-library-row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
              <input
                className="exercise-library-name"
                defaultValue={ex.name}
                onBlur={(e) => void renameExercise(ex, e.target.value)}
              />
              <button type="button" className="btn btn-ghost" style={{ padding: '0.35rem 0.5rem' }} disabled={busy} onClick={() => void removeExercise(ex)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
