import { describe, expect, it } from 'vitest';
import {
  blockMinutesTotal,
  daysUsingExercise,
  exerciseSlugsOfDay,
  exerciseSlugsOfProgram,
  findDay,
  formatPrescription,
} from '@/lib/program';
import type { Program } from '@/content/schemas';

const program: Program = {
  id: 'p',
  title: 'p',
  audience: 'a',
  weeks: 12,
  phases: [
    { id: 'p1', weeks: [1, 2], label: 'w', goal: 'g', strength: 's', balance: 'b' },
    { id: 'p2', weeks: [3, 4], label: 'w', goal: 'g', strength: 's', balance: 'b' },
    { id: 'p3', weeks: [5, 8], label: 'w', goal: 'g', strength: 's', balance: 'b' },
    { id: 'p4', weeks: [9, 12], label: 'w', goal: 'g', strength: 's', balance: 'b' },
  ],
  deloadWeeks: [4, 8, 12],
  warmup: [],
  cooldown: [],
  daily: [],
  days: [
    {
      weekday: 'monday',
      kind: 'strength',
      title: 'A',
      durationMin: 20,
      blocks: [
        {
          title: 'b',
          minutesFrom: 0,
          minutesTo: 10,
          items: [
            { exercise: 'x', prescriptions: presc() },
            { text: 'walk', minutes: 2 },
            { exercise: 'y', prescriptions: presc() },
            { exercise: 'x', prescriptions: presc() },
          ],
        },
        { title: 'c', minutesFrom: 10, minutesTo: 20, items: [{ text: 'cool' }] },
      ],
    },
    ...(['tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(
      (weekday) => ({ weekday, kind: 'rest' as const, title: 'r', durationMin: 0, blocks: [] }),
    ),
  ],
};

function presc() {
  const p = { sets: 3, reps: '8–12', step: 'working' as const, restSec: 60 };
  return { p1: p, p2: p, p3: p, p4: p };
}

describe('program helpers', () => {
  it('findDay', () => {
    expect(findDay(program, 'monday').title).toBe('A');
  });
  it('findDay throws when the program has no such weekday', () => {
    const sixDays = {
      ...program,
      days: program.days.filter((d) => d.weekday !== 'friday'),
    } as Program;
    expect(sixDays.days).toHaveLength(6);
    expect(() => findDay(sixDays, 'friday')).toThrow(/has no day friday/);
  });
  it('exerciseSlugsOfDay keeps order and dedupes', () => {
    expect(exerciseSlugsOfDay(findDay(program, 'monday'))).toEqual(['x', 'y']);
  });
  it('exerciseSlugsOfProgram and daysUsingExercise', () => {
    expect(exerciseSlugsOfProgram(program)).toEqual(['x', 'y']);
    expect(daysUsingExercise(program, 'x')).toEqual(['monday']);
    expect(daysUsingExercise(program, 'nope')).toEqual([]);
  });
  it('blockMinutesTotal', () => {
    expect(blockMinutesTotal(findDay(program, 'monday'))).toBe(20);
  });
  it('formatPrescription', () => {
    expect(formatPrescription({ sets: 3, reps: '8–12', step: 'working', restSec: 60 }, 'ru')).toBe(
      '3 × 8–12',
    );
    expect(formatPrescription({ sets: 2, seconds: 30, step: 'base', restSec: 60 }, 'ru')).toBe(
      '2 × 30 с',
    );
  });
  it('formatPrescription renders whole minutes as minutes', () => {
    expect(formatPrescription({ sets: 1, seconds: 300, step: 'base', restSec: 0 }, 'ru')).toBe(
      '1 × 5 мин',
    );
    expect(formatPrescription({ sets: 1, seconds: 60, step: 'base', restSec: 0 }, 'ru')).toBe(
      '1 × 1 мин',
    );
    expect(formatPrescription({ sets: 1, seconds: 90, step: 'base', restSec: 0 }, 'ru')).toBe(
      '1 × 90 с',
    );
    expect(formatPrescription({ sets: 2, seconds: 30, step: 'base', restSec: 0 }, 'ru')).toBe(
      '2 × 30 с',
    );
  });
});
