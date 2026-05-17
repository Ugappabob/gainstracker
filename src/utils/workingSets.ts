import { estimateOneRepMaxEpley, roundLb } from '@/utils/oneRepMax';

export type WorkoutSet = { reps: number; weight: number };

/** Sets below this fraction of the session's top weight are treated as warm-ups (no tag in data). */
export const WARMUP_WEIGHT_RATIO = 0.9;

export function isLoggedSet(s: WorkoutSet): boolean {
  const w = Number(s.weight);
  const r = Number(s.reps);
  return Number.isFinite(w) && w > 0 && Number.isFinite(r) && r >= 1;
}

/** Logged sets that are not warm-ups (weight ≥ 90% of session top). */
export function workingSetsInSession(sets: WorkoutSet[]): WorkoutSet[] {
  const logged = sets.filter(isLoggedSet);
  if (logged.length === 0) return [];
  const sessionMax = Math.max(...logged.map((s) => Number(s.weight)));
  const floor = sessionMax * WARMUP_WEIGHT_RATIO;
  return logged.filter((s) => Number(s.weight) >= floor);
}

export function heaviestWorkingSet(sets: WorkoutSet[]): { weight: number; reps: number } | null {
  const working = workingSetsInSession(sets);
  if (working.length === 0) return null;

  let bestW = 0;
  let bestR = 0;
  for (const s of working) {
    const w = Number(s.weight);
    const r = Number(s.reps);
    if (w > bestW || (w === bestW && r > bestR)) {
      bestW = w;
      bestR = r;
    }
  }
  return { weight: bestW, reps: bestR };
}

export function bestSessionE1rm(sets: WorkoutSet[]): { e1rm: number; weight: number; reps: number } | null {
  const working = workingSetsInSession(sets);
  if (working.length === 0) return null;

  let best: { e1rm: number; weight: number; reps: number } | null = null;
  for (const s of working) {
    const w = Number(s.weight);
    const r = Number(s.reps);
    const e1rm = estimateOneRepMaxEpley(w, r);
    if (!best || e1rm > best.e1rm) {
      best = { e1rm, weight: w, reps: r };
    }
  }
  return best ? { ...best, e1rm: roundLb(best.e1rm) } : null;
}
