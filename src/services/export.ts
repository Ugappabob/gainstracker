import { listAllWorkouts, listLines } from '@/services/workouts';
import { csvRow, downloadCsv } from '@/utils/downloadCsv';

function workoutDateIso(w: { startedAt?: { toDate?: () => Date } }): string {
  const d = w.startedAt?.toDate?.();
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

/** Builds CSV rows for all workouts and lines belonging to `ownerUid`. */
export async function buildWorkoutExportCsv(ownerUid: string): Promise<string> {
  const workouts = await listAllWorkouts(ownerUid);
  const header = csvRow([
    'date',
    'status',
    'location',
    'title',
    'exercise',
    'set_num',
    'weight',
    'reps',
    'warmup',
  ]);
  const rows: string[] = [header];

  for (const w of workouts) {
    const lines = await listLines(w.id);
    const dateLabel = workoutDateIso(w);
    const status = w.status;
    const location = w.location ?? '';
    const title = w.title ?? '';

    if (lines.length === 0) {
      rows.push(csvRow([dateLabel, status, location, title, '', '', '', '', '']));
      continue;
    }

    for (const line of lines) {
      if (line.sets.length === 0) {
        rows.push(csvRow([dateLabel, status, location, title, line.exerciseName, '', '', '', '']));
        continue;
      }
      line.sets.forEach((set, i) => {
        rows.push(
          csvRow([
            dateLabel,
            status,
            location,
            title,
            line.exerciseName,
            i + 1,
            set.weight,
            set.reps,
            set.warmUp === true,
          ]),
        );
      });
    }
  }

  return rows.join('\r\n');
}

export async function exportWorkoutsCsv(ownerUid: string, filenameStem: string): Promise<void> {
  const csv = await buildWorkoutExportCsv(ownerUid);
  const safeStem = filenameStem.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'workouts';
  downloadCsv(`${safeStem}-export.csv`, csv);
}

/** Human-readable last session label for roster cards. */
export function formatLastWorkoutLabel(
  lastWorkoutAt: { toDate?: () => Date } | null | undefined,
): string {
  if (!lastWorkoutAt?.toDate) return 'Never logged';
  const d = lastWorkoutAt.toDate();
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Last session: today';
  if (diffDays === 1) return 'Last session: yesterday';
  return `Last session: ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
