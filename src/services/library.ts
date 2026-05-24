import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb } from '@/firebase/config';
import { labelFromCustomExerciseId } from '@/utils/customExerciseId';
import type { Exercise, TemplateLine, WorkoutTemplate } from '@/types/models';

export async function listExercises(): Promise<Exercise[]> {
  const snap = await getDocs(query(collection(getDb(), 'exercises'), orderBy('name', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, name: (d.data() as { name: string }).name }));
}

export async function createExercise(name: string): Promise<Exercise> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Exercise name is required.');
  const ref = doc(collection(getDb(), 'exercises'));
  await setDoc(ref, { name: trimmed });
  return { id: ref.id, name: trimmed };
}

export async function updateExercise(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Exercise name is required.');
  await setDoc(doc(getDb(), 'exercises', id), { name: trimmed }, { merge: true });
}

export async function deleteExercise(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'exercises', id));
}

export async function listTemplates(): Promise<WorkoutTemplate[]> {
  const snap = await getDocs(query(collection(getDb(), 'templates'), orderBy('name', 'asc')));
  return snap.docs.map((d) => {
    const x = d.data() as { name: string; lines: WorkoutTemplate['lines'] };
    return { id: d.id, name: x.name, lines: x.lines ?? [] };
  });
}

export async function saveTemplate(input: {
  id?: string;
  name: string;
  lines: TemplateLine[];
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Template name is required.');
  if (input.lines.length === 0) throw new Error('Add at least one exercise to the template.');
  const ref = input.id ? doc(getDb(), 'templates', input.id) : doc(collection(getDb(), 'templates'));
  await setDoc(ref, { name, lines: input.lines });
  return ref.id;
}

export async function deleteTemplate(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'templates', id));
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
        const label =
          x.exerciseName && String(x.exerciseName).trim().length > 0
            ? String(x.exerciseName).trim()
            : labelFromCustomExerciseId(x.exerciseId);
        fromHist.set(x.exerciseId, label);
      }
    }

    if (snap.docs.length < pageSize) break;
    cursor = snap.docs[snap.docs.length - 1]!;
  }

  const lib = await listExercises();
  const merged = new Map<string, string>();
  for (const [id, label] of fromHist) merged.set(id, label);
  for (const e of lib) {
    if (!merged.has(e.id)) merged.set(e.id, e.name);
  }

  return [...merged.entries()]
    .map(([id, label]) => ({ id, name: label, fromHistory: fromHist.has(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function defaultTemplateLine(exercise: Exercise): TemplateLine {
  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    defaultSets: [
      { reps: 8, weight: 0 },
      { reps: 8, weight: 0 },
      { reps: 8, weight: 0 },
    ],
  };
}
