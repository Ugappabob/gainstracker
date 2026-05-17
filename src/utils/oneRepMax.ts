/** Reps above this use the cap when applying Epley (reduces noise on high-rep sets). */
export const E1RM_REP_CAP = 10;

/** Epley estimate; 1 rep returns actual weight. Ignores non-positive weight. */
export function estimateOneRepMaxEpley(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  if (!Number.isFinite(reps) || reps < 1) return 0;
  if (reps === 1) return weight;
  const cappedReps = Math.min(reps, E1RM_REP_CAP);
  return weight * (1 + cappedReps / 30);
}

export function roundLb(n: number): number {
  return Math.round(n);
}
