import { describe, expect, it } from 'vitest';
import { plannedTopReps, shouldProgress } from '@/lib/progression';

describe('plannedTopReps', () => {
  it('reads a plain number', () => {
    expect(plannedTopReps('10')).toBe(10);
  });
  it('reads the top of a range', () => {
    expect(plannedTopReps('8–12')).toBe(12);
  });
  it('ignores trailing words', () => {
    expect(plannedTopReps('10 на сторону')).toBe(10);
    expect(plannedTopReps('6 в каждом направлении')).toBe(6);
    expect(plannedTopReps('10 шагов вперёд и 10 назад')).toBe(10);
  });
  it('returns null when there is no number', () => {
    expect(plannedTopReps(undefined)).toBeNull();
    expect(plannedTopReps('по ощущениям')).toBeNull();
  });
});

describe('shouldProgress', () => {
  it('suggests more load after two sessions two reps above plan', () => {
    expect(shouldProgress(10, [12, 12])).toBe(true);
    expect(shouldProgress(10, [13, 12])).toBe(true);
  });
  it('stays quiet when one session is short', () => {
    expect(shouldProgress(10, [12, 11])).toBe(false);
  });
  it('stays quiet without two sessions or without a plan', () => {
    expect(shouldProgress(10, [12])).toBe(false);
    expect(shouldProgress(null, [12, 12])).toBe(false);
  });
});
