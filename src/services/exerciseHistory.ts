import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { getDb } from '@/firebase/config';
import { deleteDocumentRefsInChunks } from '@/services/batchDelete';
import type { ExerciseHistoryEntry } from '@/types/models';

const historyCol = () => collection(getDb(), 'exerciseHistory');

export type ExerciseHistoryWrite = {
  userId: string;
  exerciseId: string;
  exerciseName: string;
  workoutId: string;
  sets: { reps: number; weight: number }[];
};

/** Last completed sessions for an exercise, newest first. Skips the current workout id. */
export async function fetchLastSessionsForExercise(
  userId: string,
  exerciseId: string,
  opts: { excludeWorkoutId?: string; maxSessions?: number } = {},
): Promise<Pick<ExerciseHistoryEntry, 'workoutId' | 'completedAt' | 'sets'>[]> {
  const maxSessions = opts.maxSessions ?? 3;
  const qy = query(
    historyCol(),
    where('userId', '==', userId),
    where('exerciseId', '==', exerciseId),
    orderBy('completedAt', 'desc'),
    limit(maxSessions),
  );
  const snap = await getDocs(qy);
  const rows = snap.docs.map((d) => {
    const x = d.data() as {
      workoutId: string;
      completedAt: Timestamp;
      sets: { reps: number; weight: number }[];
    };
    return { workoutId: x.workoutId, completedAt: x.completedAt, sets: x.sets };
  });
  const filtered = opts.excludeWorkoutId
    ? rows.filter((r) => r.workoutId !== opts.excludeWorkoutId)
    : rows;
  return filtered.slice(0, 2);
}

export async function writeExerciseHistoryEntries(entries: ExerciseHistoryWrite[]): Promise<void> {
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(getDb());
    for (const e of entries.slice(i, i + 400)) {
      const ref = doc(historyCol());
      batch.set(ref, {
        userId: e.userId,
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        workoutId: e.workoutId,
        completedAt: serverTimestamp(),
        sets: e.sets,
      });
    }
    await batch.commit();
  }
}

export async function deleteHistoryForWorkout(workoutId: string, ownerUid: string): Promise<void> {
  const qy = query(
    historyCol(),
    where('userId', '==', ownerUid),
    where('workoutId', '==', workoutId),
  );
  const snap = await getDocs(qy);
  await deleteDocumentRefsInChunks(snap.docs.map((d) => d.ref));
}
