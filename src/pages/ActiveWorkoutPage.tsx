import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadCoachProfile } from '@/constants/coach';
import { ExerciseHistoryPanel } from '@/components/ExerciseHistoryPanel';
import ExercisePicker from '@/components/ExercisePicker';
import {
  deleteWorkout,
  addLine,
  completeWorkout,
  deleteLine,
  getWorkout,
  listLines,
  syncExerciseHistoryFromWorkout,
  updateLineSets,
} from '@/services/workouts';
import { listExercises } from '@/services/library';
import type { Exercise, Workout, WorkoutLine, WorkoutSet } from '@/types/models';

function SetsEditor({
  sets,
  onChange,
  readOnly = false,
}: {
  sets: WorkoutSet[];
  onChange: (next: WorkoutSet[]) => void;
  readOnly?: boolean;
}) {
  const update = (i: number, field: 'reps' | 'weight', raw: string) => {
    const n = raw === '' ? 0 : Number(raw);
    const v = Number.isFinite(n) ? n : 0;
    const next = sets.map((s, j) => (j === i ? { ...s, [field]: v } : s));
    onChange(next);
  };

  const toggleWarmUp = (i: number) => {
    const next = sets.map((s, j) => (j === i ? { ...s, warmUp: !s.warmUp } : s));
    onChange(next);
  };

  return (
    <div className="stack" style={{ gap: '0.35rem' }}>
      {sets.map((s, i) => (
        <div key={i} className={`set-row${s.warmUp ? ' set-row-warmup' : ''}`}>
          <label className="muted set-field">
            Weight
            <input
              type="number"
              inputMode="decimal"
              value={s.weight || ''}
              readOnly={readOnly}
              onChange={(e) => update(i, 'weight', e.target.value)}
            />
          </label>
          <label className="muted set-field">
            Reps
            <input
              type="number"
              inputMode="numeric"
              value={s.reps || ''}
              readOnly={readOnly}
              onChange={(e) => update(i, 'reps', e.target.value)}
            />
          </label>
          {!readOnly && (
            <label className="row set-warmup-toggle" style={{ gap: '0.35rem', margin: 0 }}>
              <input type="checkbox" checked={!!s.warmUp} onChange={() => toggleWarmUp(i)} />
              <span className="muted">Warm-up</span>
            </label>
          )}
          {readOnly && s.warmUp && <span className="muted set-warmup-label">Warm-up</span>}
        </div>
      ))}
    </div>
  );
}

function LineBlock({
  workoutId,
  line,
  ownerUid,
  currentWorkoutId,
  sessionCompleted,
  readOnly,
  onPersistSets,
  onRemoveLine,
}: {
  workoutId: string;
  line: WorkoutLine;
  ownerUid: string;
  currentWorkoutId: string;
  sessionCompleted: boolean;
  readOnly: boolean;
  onPersistSets: () => void | Promise<void>;
  onRemoveLine: (lineId: string) => void;
}) {
  const [sets, setSets] = useState(line.sets);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSets(line.sets);
  }, [line.id, line.sets]);

  const scheduleSave = useCallback(
    (next: WorkoutSet[]) => {
      if (readOnly) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        debounceRef.current = null;
        try {
          await updateLineSets(workoutId, line.id, next);
          if (sessionCompleted) {
            await onPersistSets();
          }
        } catch {
          /* Firestore queues offline */
        }
      }, 550);
    },
    [workoutId, line.id, sessionCompleted, onPersistSets, readOnly],
  );

  const onChange = (next: WorkoutSet[]) => {
    setSets(next);
    scheduleSave(next);
  };

  const addSet = () => {
    const last = sets[sets.length - 1] ?? { reps: 8, weight: 0, warmUp: false };
    onChange([...sets, { reps: last.reps, weight: last.weight, warmUp: last.warmUp ?? false }]);
  };

  const removeSet = () => {
    if (sets.length <= 1) return;
    onChange(sets.slice(0, -1));
  };

  return (
    <div className="card stack" style={{ marginTop: '0.75rem' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem' }}>
        <span className="exercise-pill">{line.exerciseName}</span>
        {!readOnly && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" style={{ padding: '0.35rem 0.5rem' }} onClick={addSet}>
              + Set
            </button>
            <button type="button" className="btn btn-ghost" style={{ padding: '0.35rem 0.5rem' }} onClick={removeSet}>
              − Set
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '0.35rem 0.5rem' }}
              onClick={() => onRemoveLine(line.id)}
            >
              Remove exercise
            </button>
          </div>
        )}
      </div>
      <SetsEditor sets={sets} onChange={onChange} readOnly={readOnly} />
      <ExerciseHistoryPanel userId={ownerUid} exerciseId={line.exerciseId} excludeWorkoutId={currentWorkoutId} />
    </div>
  );
}

export default function ActiveWorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [lines, setLines] = useState<WorkoutLine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!id || !user) return;
    setError(null);
    const w = await getWorkout(id);
    if (!w) {
      setWorkout(null);
      setLines([]);
      setError('Workout not found.');
      return;
    }
    const canView = w.ownerUid === user.uid || isHeadCoachProfile(profile, user.email);
    if (!canView) {
      setWorkout(null);
      setLines([]);
      setError('Workout not found.');
      return;
    }
    setWorkout(w);
    const ls = await listLines(id);
    setLines(ls);
  }, [id, user, profile]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void listExercises()
      .then(setExercises)
      .catch(() => setExercises([]));
  }, []);

  const sessionCompleted = workout?.status === 'completed';
  const sessionInProgress = workout?.status === 'in_progress';
  const athleteUid = workout?.ownerUid ?? user?.uid ?? '';
  const readOnly = !!workout && !!user && workout.ownerUid !== user.uid;

  const persistHistoryIfCompleted = useCallback(async () => {
    if (!id || !athleteUid || !sessionCompleted || readOnly) return;
    await syncExerciseHistoryFromWorkout(id, athleteUid);
  }, [id, athleteUid, sessionCompleted, readOnly]);

  const nextOrder = useMemo(() => (lines.length ? Math.max(...lines.map((l) => l.order)) + 1 : 0), [lines]);

  const addExercise = async (exerciseId: string, exerciseName: string) => {
    if (!id || !user) return;
    setBusy(true);
    setError(null);
    try {
      await addLine(id, {
        exerciseId,
        exerciseName,
        order: nextOrder,
        sets: [{ reps: 8, weight: 0 }],
      });
      if (sessionCompleted) {
        await syncExerciseHistoryFromWorkout(id, athleteUid);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add exercise.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveLine = async (lineId: string) => {
    if (!id || !user) return;
    if (!window.confirm('Remove this exercise from the session?')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLine(id, lineId);
      if (sessionCompleted) {
        await syncExerciseHistoryFromWorkout(id, athleteUid);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove exercise.');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!id || !user || !sessionInProgress) return;
    setBusy(true);
    setError(null);
    try {
      await completeWorkout(id, athleteUid);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish workout.');
    } finally {
      setBusy(false);
    }
  };

  const removeWorkout = async (message: string) => {
    if (!id) return;
    if (!window.confirm(message)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteWorkout(id);
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete workout. Try again when online.');
    } finally {
      setBusy(false);
    }
  };

  const abandon = () =>
    void removeWorkout('Delete this in-progress workout and all its sets?');

  const deleteCompleted = () =>
    void removeWorkout(
      'Delete this completed workout permanently? Its data will be removed from history and trends.',
    );

  if (!user) return <p className="layout muted">Sign in required.</p>;
  if (!id) return <p className="layout muted">Missing workout id.</p>;

  return (
    <div className="layout stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{sessionCompleted ? 'Workout (completed)' : 'Active workout'}</h1>
          {workout && (
            <p className="muted" style={{ margin: 0 }}>
              Started {workout.startedAt?.toDate?.().toLocaleString?.() ?? '—'}
            </p>
          )}
        </div>
        <Link to="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          Home
        </Link>
      </div>

      {readOnly && (
        <p className="muted" style={{ margin: 0 }}>
          Read-only view (coach). This athlete&apos;s session cannot be edited from your account.
        </p>
      )}

      {sessionCompleted && !readOnly && (
        <p className="muted" style={{ margin: 0 }}>
          You can edit sets, add exercises, or remove exercises; history and trends update from this session when you
          change sets or the exercise list.
        </p>
      )}

      {error && <p style={{ color: '#fca5a5' }}>{error}</p>}

      {!readOnly && (
      <div className="card stack">
        <h2>Add exercise</h2>
        <p className="muted" style={{ margin: 0 }}>
          Pick from the library or add a custom name. Library names keep history consistent.
        </p>
        <ExercisePicker exercises={exercises} disabled={busy} onPick={(eid, ename) => void addExercise(eid, ename)} />
      </div>
      )}

      <div className="stack">
        {lines.map((line) => (
          <LineBlock
            key={line.id}
            workoutId={id}
            line={line}
            ownerUid={athleteUid}
            currentWorkoutId={id}
            sessionCompleted={!!sessionCompleted}
            readOnly={readOnly}
            onPersistSets={() => persistHistoryIfCompleted()}
            onRemoveLine={(lid) => void handleRemoveLine(lid)}
          />
        ))}
        {lines.length === 0 && <p className="muted">Add at least one exercise to begin logging.</p>}
      </div>

      {!readOnly && (sessionInProgress || sessionCompleted) && (
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {sessionInProgress && (
            <>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void finish()}>
                {busy ? 'Saving…' : 'Finish workout'}
              </button>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={abandon}>
                Abandon
              </button>
            </>
          )}
          {sessionCompleted && (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={deleteCompleted}>
              {busy ? 'Deleting…' : 'Delete workout'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
