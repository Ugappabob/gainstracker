import { estimateOneRepMaxEpley, roundLb } from '@/utils/oneRepMax';
import type { WorkoutSet } from '@/types/models';

/** Legacy imports: sets below this fraction of session top weight are treated as warm-ups when warmUp is unset. */
export const WARMUP_WEIGHT_RATIO = 0.9;

export function isLoggedSet(s: WorkoutSet): boolean {
  const w = Number(s.weight);
  const r = Number(s.reps);
  return Number.isFinite(w) && w > 0 && Number.isFinite(r) && r >= 1;
}

function isExplicitWarmUp(s: WorkoutSet): boolean {
  return s.warmUp === true;
}

function isLegacyWarmUpByWeight(s: WorkoutSet, sessionMax: number): boolean {
  if (s.warmUp === false) return false;
  if (s.warmUp === true) return true;
  return Number(s.weight) < sessionMax * WARMUP_WEIGHT_RATIO;
}

/** Logged sets that count as working sets for trends. */
export function workingSetsInSession(sets: WorkoutSet[]): WorkoutSet[] {
  const logged = sets.filter(isLoggedSet);
  if (logged.length === 0) return [];
  const sessionMax = Math.max(...logged.map((s) => Number(s.weight)));
  return logged.filter((s) => !isExplicitWarmUp(s) && !isLegacyWarmUpByWeight(s, sessionMax));
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
