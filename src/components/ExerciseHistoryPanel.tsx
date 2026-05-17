import { useEffect, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { fetchLastSessionsForExercise } from '@/services/exerciseHistory';
import { useOnline } from '@/hooks/useOnline';

function formatSessionDate(ts: Timestamp): string {
  try {
    return ts.toDate().toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatSets(sets: { reps: number; weight: number }[]): string {
  if (!sets.length) return 'No sets logged';
  return sets.map((s) => `${s.weight}×${s.reps}`).join(', ');
}

type Props = {
  userId: string;
  exerciseId: string;
  excludeWorkoutId?: string;
};

export function ExerciseHistoryPanel({ userId, exerciseId, excludeWorkoutId }: Props) {
  const online = useOnline();
  const [sessions, setSessions] = useState<
    { workoutId: string; completedAt: Timestamp; sets: { reps: number; weight: number }[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchLastSessionsForExercise(userId, exerciseId, {
          excludeWorkoutId,
          maxSessions: 3,
        });
        if (!cancelled) setSessions(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, exerciseId, excludeWorkoutId]);

  return (
    <div className="history-panel">
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.35rem' }}>Last 2 sessions</h3>
      {!online && (
        <p className="muted" style={{ margin: '0 0 0.35rem' }}>
          Offline — history shows what is already synced on this device.
        </p>
      )}
      {loading && <p className="muted">Loading…</p>}
      {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
      {!loading && !error && sessions.length === 0 && (
        <p className="muted">No completed history for this exercise yet.</p>
      )}
      {!loading &&
        !error &&
        sessions.map((s) => (
          <div key={`${s.workoutId}-${s.completedAt?.toMillis?.() ?? s.workoutId}`} className="history-block">
            <div className="muted" style={{ marginBottom: '0.25rem' }}>
              {formatSessionDate(s.completedAt)}
            </div>
            <div>{formatSets(s.sets)}</div>
          </div>
        ))}
    </div>
  );
}
