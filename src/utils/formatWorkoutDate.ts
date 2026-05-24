import type { Workout } from '@/types/models';

export function formatWorkoutDate(w: Workout): string {
  const d = w.startedAt?.toDate?.();
  if (!d) return 'Unknown date';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
