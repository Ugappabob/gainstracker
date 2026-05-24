import { describe, expect, it } from 'vitest';
import { setsForRepeat } from '@/services/workouts';

describe('setsForRepeat', () => {
  it('keeps weights and set count but clears reps', () => {
    expect(
      setsForRepeat([
        { weight: 225, reps: 5 },
        { weight: 315, reps: 1, warmUp: true },
      ]),
    ).toEqual([
      { weight: 225, reps: 0 },
      { weight: 315, reps: 0, warmUp: true },
    ]);
  });
});
