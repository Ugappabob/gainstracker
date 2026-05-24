import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb } from '@/firebase/config';
import { deleteDocumentRefsInChunks } from '@/services/batchDelete';
import { deleteHistoryForWorkout, writeExerciseHistoryEntries } from '@/services/exerciseHistory';
import type { Workout, WorkoutLine, WorkoutSet, WorkoutStatus } from '@/types/models';

const workoutsCol = () => collection(getDb(), 'workouts');

export function workoutDoc(id: string): DocumentReference {
  return doc(getDb(), 'workouts', id);
}

export function linesCol(workoutId: string) {
  return collection(getDb(), 'workouts', workoutId, 'lines');
}

export async function createBlankWorkout(ownerUid: string): Promise<string> {
  const ref = await addDoc(workoutsCol(), {
    ownerUid,
    status: 'in_progress' as WorkoutStatus,
    startedAt: serverTimestamp(),
    completedAt: null,
    templateId: null,
    location: null,
    title: null,
  });
  return ref.id;
}

/** Same structure as a past session: exercises, set count, and weights; reps cleared. */
export function setsForRepeat(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.map((s) => {
    const next: WorkoutSet = { weight: Number(s.weight) || 0, reps: 0 };
    if (s.warmUp === true) next.warmUp = true;
    return next;
  });
}

async function createWorkoutWithLines(
  ownerUid: string,
  workoutFields: {
    templateId?: string | null;
    repeatedFromWorkoutId?: string | null;
    location?: string | null;
    title?: string | null;
  },
  lines: { exerciseId: string; exerciseName: string; order: number; sets: WorkoutSet[] }[],
): Promise<string> {
  const ref = await addDoc(workoutsCol(), {
    ownerUid,
    status: 'in_progress' as WorkoutStatus,
    startedAt: serverTimestamp(),
    completedAt: null,
    templateId: workoutFields.templateId ?? null,
    repeatedFromWorkoutId: workoutFields.repeatedFromWorkoutId ?? null,
    location: workoutFields.location ?? null,
    title: workoutFields.title ?? null,
  });
  const wid = ref.id;
  const batch = writeBatch(getDb());
  for (const line of lines) {
    const lineRef = doc(linesCol(wid));
    batch.set(lineRef, {
      exerciseId: line.exerciseId,
      exerciseName: line.exerciseName,
      order: line.order,
      sets: line.sets,
    });
  }
  await batch.commit();
  return wid;
}

export async function createWorkoutFromPrevious(ownerUid: string, sourceWorkoutId: string): Promise<string> {
  const source = await getWorkout(sourceWorkoutId);
  if (!source) throw new Error('Workout not found.');
  if (source.ownerUid !== ownerUid) throw new Error('You can only repeat your own workouts.');
  if (source.status !== 'completed') throw new Error('Only completed workouts can be repeated.');

  const sourceLines = await listLines(sourceWorkoutId);
  if (sourceLines.length === 0) throw new Error('That workout has no exercises to repeat.');

  const lines = sourceLines.map((line, i) => ({
    exerciseId: line.exerciseId,
    exerciseName: line.exerciseName,
    order: i,
    sets: setsForRepeat(line.sets),
  }));

  return createWorkoutWithLines(
    ownerUid,
    {
      repeatedFromWorkoutId: sourceWorkoutId,
      location: source.location,
      title: source.title,
    },
    lines,
  );
}

export async function createWorkoutFromTemplate(
  ownerUid: string,
  templateId: string,
  lines: { exerciseId: string; exerciseName: string; order: number; sets: WorkoutSet[] }[],
): Promise<string> {
  return createWorkoutWithLines(ownerUid, { templateId }, lines);
}

export async function getWorkout(workoutId: string): Promise<Workout | null> {
  const snap = await getDoc(workoutDoc(workoutId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    ownerUid: d.ownerUid as string,
    status: d.status as WorkoutStatus,
    startedAt: d.startedAt,
    completedAt: d.completedAt ?? null,
    templateId: d.templateId ?? null,
    location: d.location ?? null,
    title: d.title ?? null,
  };
}

export async function listLines(workoutId: string): Promise<WorkoutLine[]> {
  const qy = query(linesCol(workoutId), orderBy('order', 'asc'));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const x = d.data() as {
      exerciseId: string;
      exerciseName: string;
      order: number;
      sets: { reps: number; weight: number }[];
    };
    return { id: d.id, ...x };
  });
}

export async function addLine(
  workoutId: string,
  input: { exerciseId: string; exerciseName: string; order: number; sets: { reps: number; weight: number }[] },
): Promise<void> {
  await addDoc(linesCol(workoutId), {
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    order: input.order,
    sets: input.sets,
  });
}

export async function deleteLine(workoutId: string, lineId: string): Promise<void> {
  await deleteDoc(doc(linesCol(workoutId), lineId));
}

export async function updateLineSets(
  workoutId: string,
  lineId: string,
  sets: { reps: number; weight: number }[],
): Promise<void> {
  await updateDoc(doc(linesCol(workoutId), lineId), { sets });
}

/** Rebuild exerciseHistory rows for this workout from current lines (same workoutId). */
export async function syncExerciseHistoryFromWorkout(workoutId: string, ownerUid: string): Promise<void> {
  await deleteHistoryForWorkout(workoutId, ownerUid);
  const lines = await listLines(workoutId);
  const rows = lines
    .filter((l) => l.sets.length > 0)
    .map((l) => ({
      userId: ownerUid,
      exerciseId: l.exerciseId,
      exerciseName: l.exerciseName,
      workoutId,
      sets: l.sets,
    }));
  if (rows.length) {
    await writeExerciseHistoryEntries(rows);
  }
}

export async function completeWorkout(workoutId: string, ownerUid: string): Promise<void> {
  const lines = await listLines(workoutId);
  await updateDoc(workoutDoc(workoutId), {
    status: 'completed' as WorkoutStatus,
    completedAt: serverTimestamp(),
  });
  const historyRows = lines
    .filter((l) => l.sets.length > 0)
    .map((l) => ({
      userId: ownerUid,
      exerciseId: l.exerciseId,
      exerciseName: l.exerciseName,
      workoutId,
      sets: l.sets,
    }));
  if (historyRows.length) {
    await writeExerciseHistoryEntries(historyRows);
  }
}

/** Removes workout, its lines, and exerciseHistory rows for that session. */
export async function deleteWorkout(workoutId: string): Promise<void> {
  const wSnap = await getDoc(workoutDoc(workoutId));
  if (!wSnap.exists()) return;
  const ownerUid = wSnap.data().ownerUid as string;
  await deleteHistoryForWorkout(workoutId, ownerUid);
  const linesSnap = await getDocs(linesCol(workoutId));
  await deleteDocumentRefsInChunks(linesSnap.docs.map((d) => d.ref));
  await deleteDoc(workoutDoc(workoutId));
}

/** @deprecated Use deleteWorkout */
export const abandonWorkout = deleteWorkout;

export const WORKOUT_HISTORY_PAGE_SIZE = 40;

function mapWorkoutDoc(d: QueryDocumentSnapshot<DocumentData>): Workout {
  const x = d.data();
  return {
    id: d.id,
    ownerUid: x.ownerUid as string,
    status: x.status as WorkoutStatus,
    startedAt: x.startedAt,
    completedAt: x.completedAt ?? null,
    templateId: x.templateId ?? null,
    location: x.location ?? null,
    title: x.title ?? null,
  };
}

export type WorkoutHistoryPage = {
  workouts: Workout[];
  /** Pass as `cursor` into the next page request. */
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

/** Paginated history, newest first. Optional `year` limits to that calendar year. */
export async function listWorkoutsPage(
  ownerUid: string,
  opts: {
    pageSize?: number;
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
    year?: number | null;
  } = {},
): Promise<WorkoutHistoryPage> {
  const pageSize = opts.pageSize ?? WORKOUT_HISTORY_PAGE_SIZE;
  const constraints: Parameters<typeof query>[1][] = [where('ownerUid', '==', ownerUid)];

  if (opts.year != null) {
    constraints.push(where('startedAt', '>=', Timestamp.fromDate(new Date(opts.year, 0, 1, 0, 0, 0, 0))));
    constraints.push(where('startedAt', '<', Timestamp.fromDate(new Date(opts.year + 1, 0, 1, 0, 0, 0, 0))));
  }

  constraints.push(orderBy('startedAt', 'desc'));
  if (opts.cursor) constraints.push(startAfter(opts.cursor));
  constraints.push(limit(pageSize + 1));

  const snap = await getDocs(query(workoutsCol(), ...constraints));
  const hasMore = snap.docs.length > pageSize;
  const pageDocs = snap.docs.slice(0, pageSize);
  return {
    workouts: pageDocs.map(mapWorkoutDoc),
    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1]! : null,
    hasMore,
  };
}
