import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { getDb } from '@/firebase/config';
import { bestSessionE1rm, heaviestWorkingSet } from '@/utils/workingSets';

export type TrendPoint = {
  completedAt: Timestamp;
  workoutId: string;
  maxWeight: number;
  topSetReps: number;
  est1RM: number;
  est1RMWeight: number;
  est1RMReps: number;
};

export const TREND_PAGE_SIZE = 60;

function mapTrendDoc(d: QueryDocumentSnapshot<DocumentData>): TrendPoint | null {
  const x = d.data() as {
    completedAt: Timestamp;
    workoutId: string;
    sets: { reps: number; weight: number }[];
  };

  const heaviest = heaviestWorkingSet(x.sets);
  const e1rmBest = bestSessionE1rm(x.sets);
  if (!heaviest && !e1rmBest) return null;

  return {
    completedAt: x.completedAt,
    workoutId: x.workoutId,
    maxWeight: heaviest?.weight ?? 0,
    topSetReps: heaviest?.reps ?? 0,
    est1RM: e1rmBest?.e1rm ?? 0,
    est1RMWeight: e1rmBest?.weight ?? 0,
    est1RMReps: e1rmBest?.reps ?? 0,
  };
}

export type TrendPage = {
  points: TrendPoint[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

export async function fetchExerciseTrendPage(
  userId: string,
  exerciseId: string,
  opts: { pageSize?: number; cursor?: QueryDocumentSnapshot<DocumentData> | null } = {},
): Promise<TrendPage> {
  const pageSize = opts.pageSize ?? TREND_PAGE_SIZE;
  const constraints: QueryConstraint[] = [
    where('userId', '==', userId),
    where('exerciseId', '==', exerciseId),
    orderBy('completedAt', 'desc'),
  ];
  if (opts.cursor) constraints.push(startAfter(opts.cursor));
  constraints.push(limit(pageSize + 1));

  const snap = await getDocs(query(collection(getDb(), 'exerciseHistory'), ...constraints));
  const hasMore = snap.docs.length > pageSize;
  const pageDocs = snap.docs.slice(0, pageSize);
  const points = pageDocs.map(mapTrendDoc).filter((p): p is TrendPoint => p !== null);

  return {
    points,
    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1]! : null,
    hasMore,
  };
}

/** Paginates until all sessions for this exercise are loaded (oldest → newest). */
export async function fetchAllExerciseTrend(
  userId: string,
  exerciseId: string,
  opts: { onProgress?: (loadedCount: number) => void } = {},
): Promise<TrendPoint[]> {
  const all: TrendPoint[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

  for (;;) {
    const page = await fetchExerciseTrendPage(userId, exerciseId, { cursor });
    all.push(...page.points);
    opts.onProgress?.(all.length);
    if (!page.hasMore) break;
    cursor = page.lastDoc;
  }

  return [...all].reverse();
}
