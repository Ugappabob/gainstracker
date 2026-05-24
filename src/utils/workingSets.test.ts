import { describe, expect, it } from 'vitest';
import { estimateOneRepMaxEpley } from '@/utils/oneRepMax';
import { heaviestWorkingSet, workingSetsInSession } from '@/utils/workingSets';

describe('estimateOneRepMaxEpley', () => {
  it('returns actual weight for 1 rep', () => {
    expect(estimateOneRepMaxEpley(315, 1)).toBe(315);
  });

  it('caps reps at 10 for formula', () => {
    expect(estimateOneRepMaxEpley(135, 10)).toBeCloseTo(180, 5);
    expect(estimateOneRepMaxEpley(135, 15)).toBeCloseTo(180, 5);
  });

  it('ignores zero weight', () => {
    expect(estimateOneRepMaxEpley(0, 5)).toBe(0);
  });
});

describe('workingSetsInSession', () => {
  it('excludes explicit warm-up sets', () => {
    const working = workingSetsInSession([
      { weight: 135, reps: 10, warmUp: true },
      { weight: 315, reps: 3, warmUp: false },
    ]);
    expect(working).toHaveLength(1);
    expect(working[0]!.weight).toBe(315);
  });

  it('uses weight heuristic when warmUp is unset', () => {
    const working = workingSetsInSession([
      { weight: 135, reps: 5 },
      { weight: 315, reps: 1 },
    ]);
    expect(working.map((s) => s.weight)).toEqual([315]);
  });

  it('keeps marked working sets even when lighter than 90% of top', () => {
    const working = workingSetsInSession([
      { weight: 275, reps: 3, warmUp: false },
      { weight: 315, reps: 1 },
    ]);
    expect(working.map((s) => s.weight).sort()).toEqual([275, 315]);
  });
});

describe('heaviestWorkingSet', () => {
  it('picks max weight among working sets', () => {
    const best = heaviestWorkingSet([
      { weight: 225, reps: 5 },
      { weight: 315, reps: 1 },
      { weight: 135, reps: 10, warmUp: true },
    ]);
    expect(best).toEqual({ weight: 315, reps: 1 });
  });
});
