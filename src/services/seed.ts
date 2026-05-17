import { doc, writeBatch } from 'firebase/firestore';
import { getDb } from '@/firebase/config';
import type { TemplateLine } from '@/types/models';

const exercises = [
  { id: 'ex_bench', name: 'Bench press' },
  { id: 'ex_squat', name: 'Back squat' },
  { id: 'ex_row', name: 'Barbell row' },
  { id: 'ex_ohp', name: 'Overhead press' },
  { id: 'ex_dl', name: 'Deadlift' },
];

const upperALines: TemplateLine[] = [
  {
    exerciseId: 'ex_bench',
    exerciseName: 'Bench press',
    defaultSets: [
      { reps: 8, weight: 45 },
      { reps: 8, weight: 45 },
      { reps: 8, weight: 45 },
    ],
  },
  {
    exerciseId: 'ex_row',
    exerciseName: 'Barbell row',
    defaultSets: [
      { reps: 8, weight: 65 },
      { reps: 8, weight: 65 },
      { reps: 8, weight: 65 },
    ],
  },
  {
    exerciseId: 'ex_ohp',
    exerciseName: 'Overhead press',
    defaultSets: [
      { reps: 8, weight: 35 },
      { reps: 8, weight: 35 },
    ],
  },
];

/** Upserts global exercises + starter template (idempotent). */
export async function seedGlobalLibrary(): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  for (const e of exercises) {
    batch.set(doc(db, 'exercises', e.id), { name: e.name }, { merge: true });
  }
  batch.set(
    doc(db, 'templates', 'tpl_upper_a'),
    {
      name: 'Starter — Upper A',
      lines: upperALines,
    },
    { merge: true },
  );
  await batch.commit();
}
