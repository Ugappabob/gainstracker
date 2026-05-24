import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useSubjectUser } from '@/hooks/useSubjectUser';
import { exportWorkoutsCsv } from '@/services/export';
import { createWorkoutFromPrevious, deleteWorkout, listWorkoutsPage, WORKOUT_HISTORY_PAGE_SIZE } from '@/services/workouts';
import type { Workout } from '@/types/models';
import { formatWorkoutDate } from '@/utils/formatWorkoutDate';

const HISTORY_START_YEAR = 2016;
function monthGroupKey(w: Workout): string {
  const d = w.startedAt?.toDate?.();
  if (!d) return 'Unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthGroupLabel(key: string): string {
  if (key === 'Unknown') return 'Unknown date';
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function groupByMonth(workouts: Workout[]): { key: string; label: string; items: Workout[] }[] {
  const order: string[] = [];
  const map = new Map<string, Workout[]>();
  for (const w of workouts) {
    const key = monthGroupKey(w);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(w);
  }
  return order.map((key) => ({ key, label: monthGroupLabel(key), items: map.get(key)! }));
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { subjectUid, isCoachView, loading: subjectLoading } = useSubjectUser();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Workout[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const yearOptions = useMemo(() => {
    const end = new Date().getFullYear();
    const years: number[] = [];
    for (let y = end; y >= HISTORY_START_YEAR; y--) years.push(y);
    return years;
  }, []);

  const parsedYear = yearFilter === 'all' ? null : Number(yearFilter);

  const loadFirstPage = useCallback(async () => {
    if (!subjectUid) return;
    setLoading(true);
    setErr(null);
    try {
      const page = await listWorkoutsPage(subjectUid, { year: parsedYear });
      setRows(page.workouts);
      setCursor(page.lastDoc);
      setHasMore(page.hasMore);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
      setCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [subjectUid, parsedYear]);

  const loadMore = useCallback(async () => {
    if (!subjectUid || !hasMore || loadingMore) return;
    setLoadingMore(true);
    setErr(null);
    try {
      const page = await listWorkoutsPage(subjectUid, { cursor, year: parsedYear });
      setRows((prev) => [...prev, ...page.workouts]);
      setCursor(page.lastDoc);
      setHasMore(page.hasMore);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoadingMore(false);
    }
  }, [subjectUid, cursor, parsedYear, hasMore, loadingMore]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const groups = useMemo(() => groupByMonth(rows), [rows]);

  const handleDelete = async (workoutId: string) => {
    if (
      !window.confirm(
        'Delete this workout permanently? Its data will be removed from history and trends.',
      )
    ) {
      return;
    }
    setDeletingId(workoutId);
    setErr(null);
    try {
      await deleteWorkout(workoutId);
      await loadFirstPage();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not delete workout.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRepeat = async (workoutId: string) => {
    if (!user) return;
    setRepeatingId(workoutId);
    setErr(null);
    try {
      const id = await createWorkoutFromPrevious(user.uid, workoutId);
      navigate(`/workout/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not repeat that workout.');
    } finally {
      setRepeatingId(null);
    }
  };

  const handleExport = async () => {
    if (!subjectUid || !user) return;
    setExporting(true);
    setErr(null);
    try {
      const stem = user.displayName || user.email || user.uid;
      await exportWorkoutsCsv(subjectUid, stem);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || subjectLoading) return <div className="layout muted">Loading…</div>;
  if (!user) return <div className="layout muted">Sign in required.</div>;

  const canDelete = !isCoachView;
  const canRepeat = !isCoachView;

  return (
    <div className="layout stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>{isCoachView ? 'Athlete history' : 'History'}</h1>
        <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
          {canDelete && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={exporting || loading}
              onClick={() => void handleExport()}
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
          <Link to={isCoachView ? '/roster' : '/'} className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            {isCoachView ? 'Roster' : 'Home'}
          </Link>
        </div>
      </div>

      {isCoachView && (
        <p className="muted" style={{ margin: 0 }}>
          Read-only view for athlete <code>{subjectUid}</code>
        </p>
      )}

      <label className="stack card" style={{ gap: '0.35rem', margin: 0 }}>
        <span className="muted">Jump to year</span>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="all">All years</option>
          {yearOptions.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <p className="muted" style={{ margin: 0 }}>
        {loading && rows.length === 0
          ? 'Loading sessions…'
          : `Showing ${rows.length} session${rows.length === 1 ? '' : 's'}${yearFilter !== 'all' ? ` in ${yearFilter}` : ''}${hasMore ? ' — more available' : ''}.`}
        {canRepeat && !loading && rows.length > 0 && ' Tap Repeat to start a new session with the same exercises and weights (reps blank).'}
      </p>

      {err && <p style={{ color: '#fca5a5', margin: 0 }}>{err}</p>}

      {groups.map((group) => (
        <section key={group.key} className="stack" style={{ gap: '0.5rem' }}>
          <h2 className="history-month-heading">{group.label}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
            {group.items.map((w) => (
              <li key={w.id} className="card history-session-card">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Link to={`/workout/${w.id}`} style={{ color: 'inherit', textDecoration: 'none', flex: 1 }}>
                    <div className="stack" style={{ gap: '0.2rem' }}>
                      <strong style={{ fontWeight: 600 }}>{formatWorkoutDate(w)}</strong>
                      {w.location && <span className="muted">{w.location}</span>}
                    </div>
                  </Link>
                  <div className="row" style={{ flexShrink: 0, gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="exercise-pill">{w.status}</span>
                    {canRepeat && w.status === 'completed' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.6rem' }}
                        disabled={repeatingId !== null || deletingId !== null}
                        onClick={() => void handleRepeat(w.id)}
                      >
                        {repeatingId === w.id ? '…' : 'Repeat'}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '0.35rem 0.6rem' }}
                        disabled={deletingId !== null}
                        onClick={() => void handleDelete(w.id)}
                      >
                        {deletingId === w.id ? '…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!loading && rows.length === 0 && !err && <p className="muted">No workouts for this filter.</p>}

      {hasMore && (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: '100%' }}
          disabled={loadingMore || loading}
          onClick={() => void loadMore()}
        >
          {loadingMore ? 'Loading…' : `Load more (${WORKOUT_HISTORY_PAGE_SIZE} at a time)`}
        </button>
      )}
    </div>
  );
}
