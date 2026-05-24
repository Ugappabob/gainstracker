import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useSubjectUser } from '@/hooks/useSubjectUser';
import TrendLineChart, { type TrendChartRow } from '@/components/trends/TrendLineChart';
import { listExercisesForTrends, type TrendExercise } from '@/services/library';
import { fetchExerciseTrendPage, TREND_PAGE_SIZE, type TrendPoint } from '@/services/trends';
import { E1RM_REP_CAP } from '@/utils/oneRepMax';

function pointDateMs(p: TrendPoint): number {
  return p.completedAt?.toMillis?.() ?? 0;
}

function toHeaviestChartRows(points: TrendPoint[]): TrendChartRow[] {
  return points
    .filter((p) => p.maxWeight > 0)
    .map((p) => ({
      dateMs: pointDateMs(p),
      value: p.maxWeight,
      detail: `${p.maxWeight} lb × ${p.topSetReps} reps`,
    }));
}

function toE1rmChartRows(points: TrendPoint[]): TrendChartRow[] {
  return points
    .filter((p) => p.est1RM > 0)
    .map((p) => ({
      dateMs: pointDateMs(p),
      value: p.est1RM,
      detail: `From ${p.est1RMWeight} lb × ${p.est1RMReps} reps (Epley)`,
    }));
}

export default function TrendsPage() {
  const { user, loading: authLoading } = useAuth();
  const { subjectUid, isCoachView, loading: subjectLoading } = useSubjectUser();
  const [exercises, setExercises] = useState<TrendExercise[]>([]);
  const [exerciseId, setExerciseId] = useState('');
  const [exercisesErr, setExercisesErr] = useState<string | null>(null);
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [trendCursor, setTrendCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreTrend, setHasMoreTrend] = useState(false);
  const [trendErr, setTrendErr] = useState<string | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendLoadingMore, setTrendLoadingMore] = useState(false);

  useEffect(() => {
    if (!subjectUid) return;
    void (async () => {
      setExercisesLoading(true);
      setExercisesErr(null);
      try {
        const e = await listExercisesForTrends(subjectUid);
        setExercises(e);
        const withHistory = e.filter((x) => x.fromHistory);
        const pick = withHistory[0] ?? e[0];
        setExerciseId(pick?.id ?? '');
      } catch (e) {
        setExercisesErr(e instanceof Error ? e.message : 'Failed to load exercises');
        setExercises([]);
        setExerciseId('');
      } finally {
        setExercisesLoading(false);
      }
    })();
  }, [subjectUid]);

  const loadTrendFirst = useCallback(async () => {
    if (!subjectUid || !exerciseId) return;
    setTrendLoading(true);
    setTrendErr(null);
    try {
      const page = await fetchExerciseTrendPage(subjectUid, exerciseId);
      setPoints([...page.points].reverse());
      setTrendCursor(page.lastDoc);
      setHasMoreTrend(page.hasMore);
    } catch (e) {
      setTrendErr(e instanceof Error ? e.message : 'Failed to load trend');
      setPoints([]);
      setTrendCursor(null);
      setHasMoreTrend(false);
    } finally {
      setTrendLoading(false);
    }
  }, [subjectUid, exerciseId]);

  useEffect(() => {
    void loadTrendFirst();
  }, [loadTrendFirst]);

  const loadTrendMore = async () => {
    if (!subjectUid || !exerciseId || !hasMoreTrend || trendLoadingMore) return;
    setTrendLoadingMore(true);
    setTrendErr(null);
    try {
      const page = await fetchExerciseTrendPage(subjectUid, exerciseId, { cursor: trendCursor });
      setPoints((prev) => [...[...page.points].reverse(), ...prev]);
      setTrendCursor(page.lastDoc);
      setHasMoreTrend(page.hasMore);
    } catch (e) {
      setTrendErr(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setTrendLoadingMore(false);
    }
  };

  const exercisesWithHistory = useMemo(() => exercises.filter((e) => e.fromHistory), [exercises]);
  const heaviestChart = useMemo(() => toHeaviestChartRows(points), [points]);
  const e1rmChart = useMemo(() => toE1rmChartRows(points), [points]);

  if (authLoading || subjectLoading) return <div className="layout muted">Loading…</div>;
  if (!user) return <div className="layout muted">Sign in required.</div>;

  const exName = exercises.find((e) => e.id === exerciseId)?.name ?? 'Exercise';

  return (
    <div className="layout stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>{isCoachView ? 'Athlete trends' : 'Trends'}</h1>
        <Link to={isCoachView ? '/roster' : '/'} className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          {isCoachView ? 'Roster' : 'Home'}
        </Link>
      </div>

      {isCoachView && (
        <p className="muted" style={{ margin: 0 }}>
          Read-only view for athlete <code>{subjectUid}</code>
        </p>
      )}

      {exercisesErr && <p style={{ color: '#fca5a5', margin: 0 }}>{exercisesErr}</p>}

      {exercisesLoading && <p className="muted">Loading exercises from your history…</p>}

      {!exercisesLoading && exercisesWithHistory.length === 0 && !exercisesErr && (
        <p className="muted">
          No logged exercises found yet. Finish a session with at least one set, or import history first.
        </p>
      )}

      {!exercisesLoading && exercisesWithHistory.length > 0 && (
        <>
          <label className="stack card" style={{ gap: '0.35rem' }}>
            <span className="muted">Exercise ({exercisesWithHistory.length} in your logs)</span>
            <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {exercisesWithHistory.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>

          <p className="muted" style={{ margin: 0 }}>
            <strong>{exName}</strong> — working sets only (≥1 rep, weight &gt; 0, warm-ups excluded). Epley 1RM caps at{' '}
            {E1RM_REP_CAP} reps. Showing {points.length}
            {hasMoreTrend ? '+' : ''} sessions (oldest → newest).
          </p>

          {trendErr && <p style={{ color: '#fca5a5', margin: 0 }}>{trendErr}</p>}
          {trendLoading && points.length === 0 && <p className="muted">Loading trend…</p>}

          {!trendLoading && points.length > 0 && (
            <>
              <TrendLineChart
                title="Heaviest working set"
                subtitle="Max weight per session (working sets)"
                data={heaviestChart}
                valueLabel="Heaviest"
                stroke="#38bdf8"
              />
              <TrendLineChart
                title="Estimated 1RM (Epley)"
                subtitle="Best estimated 1RM per session among working sets"
                data={e1rmChart}
                valueLabel="Est. 1RM"
                stroke="#a78bfa"
              />
            </>
          )}

          <div className="card stack">
            <h2 style={{ margin: 0, fontSize: '1rem' }}>Session log</h2>
            {points.map((p) => (
              <div
                key={`${p.workoutId}-${p.completedAt?.toMillis?.() ?? ''}`}
                className="row"
                style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem' }}
              >
                <span className="muted">{p.completedAt?.toDate?.().toLocaleDateString?.() ?? '—'}</span>
                <span style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                  <span>{p.maxWeight} lb × {p.topSetReps}</span>
                  <span className="muted"> · est. {p.est1RM} lb</span>
                </span>
              </div>
            ))}
            {!trendLoading && points.length === 0 && !trendErr && (
              <p className="muted">No sessions with working sets for this exercise.</p>
            )}
          </div>

          {hasMoreTrend && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%' }}
              disabled={trendLoadingMore || trendLoading}
              onClick={() => void loadTrendMore()}
            >
              {trendLoadingMore ? 'Loading…' : `Load older sessions (${TREND_PAGE_SIZE} more)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
