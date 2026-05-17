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
} from 'firebase/firestore';
import { getDb } from '@/firebase/config';
import { labelFromCustomExerciseId } from '@/utils/customExerciseId';
import type { Exercise, WorkoutTemplate } from '@/types/models';

export async function listExercises(): Promise<Exercise[]> {
  const snap = await getDocs(query(collection(getDb(), 'exercises'), orderBy('name', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, name: (d.data() as { name: string }).name }));
}

export type TrendExercise = Exercise & { fromHistory: boolean };

/** All exercise ids this user has logged (paginates through exerciseHistory). */
export async function listExercisesForTrends(userId: string): Promise<TrendExercise[]> {
  const fromHist = new Map<string, string>();
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  const pageSize = 500;

  for (;;) {
    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      orderBy('completedAt', 'desc'),
      limit(pageSize),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    const snap = await getDocs(query(collection(getDb(), 'exerciseHistory'), ...constraints));
    if (snap.empty) break;

    for (const d of snap.docs) {
      const x = d.data() as { exerciseId: string; exerciseName?: string };
      if (!fromHist.has(x.exerciseId)) {
        const name =
          x.exerciseName && String(x.exerciseName).trim().length > 0
            ? String(x.exerciseName).trim()
            : labelFromCustomExerciseId(x.exerciseId);
        fromHist.set(x.exerciseId, name);
      }
    }

    if (snap.docs.length < pageSize) break;
    cursor = snap.docs[snap.docs.length - 1]!;
  }

  const lib = await listExercises();
  const merged = new Map<string, string>();
  for (const [id, name] of fromHist) merged.set(id, name);
  for (const e of lib) {
    if (!merged.has(e.id)) merged.set(e.id, e.name);
  }

  return [...merged.entries()]
    .map(([id, name]) => ({ id, name, fromHistory: fromHist.has(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listTemplates(): Promise<WorkoutTemplate[]> {
  const snap = await getDocs(query(collection(getDb(), 'templates'), orderBy('name', 'asc')));
  return snap.docs.map((d) => {
    const x = d.data() as { name: string; lines: WorkoutTemplate['lines'] };
    return { id: d.id, name: x.name, lines: x.lines };
  });
}
