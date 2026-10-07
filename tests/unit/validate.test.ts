import { describe, expect, it } from 'vitest';
import { validateContent } from '../../scripts/validate-content';
import type { Program } from '@/content/schemas';

const day = (weekday: Program['days'][number]['weekday'], items: unknown[] = []) => ({
  weekday,
  kind: 'strength' as const,
  title: 't',
  durationMin: 10,
  blocks: items.length
    ? [{ title: 'b', minutesFrom: 0, minutesTo: 10, items: items as never }]
    : [],
});
const presc = () => {
  const p = { sets: 2, reps: '10', step: 'base' as const, restSec: 60 };
  return { p1: p, p2: p, p3: p, p4: p };
};
const program = (items: unknown[]): Program => ({
  id: 'p',
  title: 't',
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
    day('monday', items),
    day('tuesday'),
    day('wednesday'),
    day('thursday'),
    day('friday'),
    day('saturday'),
    day('sunday'),
  ],
});

describe('validateContent', () => {
  it('passes when everything matches', () => {
    const errors = validateContent({
      program: program([{ exercise: 'x', prescriptions: presc() }]),
      exerciseSlugs: new Set(['x']),
      imageFiles: new Set(['a.png']),
      exerciseImages: new Map([['x', 'a.png']]),
      pageSlugs: new Set(['safety']),
    });
    expect(errors).toEqual([]);
  });
  it('reports unknown exercise, missing image, unused exercise, duration mismatch', () => {
    const p = program([{ exercise: 'ghost', prescriptions: presc() }]);
    p.days[0]!.durationMin = 30;
    const errors = validateContent({
      program: p,
      exerciseSlugs: new Set(['x']),
      imageFiles: new Set([]),
      exerciseImages: new Map([['x', 'missing.png']]),
      pageSlugs: new Set(['safety']),
    });
    expect(errors.join('\n')).toMatch(/ghost/);
    expect(errors.join('\n')).toMatch(/missing\.png/);
    expect(errors.join('\n')).toMatch(/unused.*x/);
    expect(errors.join('\n')).toMatch(/monday.*duration/);
  });
  it('reports two blocks of one day that share minutesFrom', () => {
    const p = program([{ exercise: 'x', prescriptions: presc() }]);
    p.days[0]!.blocks.push({
      title: 'twin',
      minutesFrom: p.days[0]!.blocks[0]!.minutesFrom,
      minutesTo: 20,
      items: [{ text: 'walk' }],
    });
    p.days[0]!.durationMin = 20;
    const errors = validateContent({
      program: p,
      exerciseSlugs: new Set(['x']),
      imageFiles: new Set(['a.png']),
      exerciseImages: new Map([['x', 'a.png']]),
      pageSlugs: new Set(['safety']),
    });
    expect(errors.join('\n')).toMatch(/repeats minutesFrom 0/);
  });
  it('reports a test that points to a missing image', () => {
    const errors = validateContent({
      program: program([{ exercise: 'x', prescriptions: presc() }]),
      exerciseSlugs: new Set(['x']),
      imageFiles: new Set(['a.png']),
      exerciseImages: new Map([['x', 'a.png']]),
      testImages: new Map([
        ['ru/tug', '../../assets/tests/tug.png'],
        ['ru/ghost', '../../assets/tests/ghost.png'],
      ]),
      testImageFiles: new Set(['../../assets/tests/tug.png']),
      pageSlugs: new Set(['safety']),
    });
    expect(errors).toEqual([
      `test "ru/ghost" points to missing image "../../assets/tests/ghost.png"`,
    ]);
  });
  it('reports a page slug that collides with a reserved route', () => {
    const errors = validateContent({
      program: program([{ exercise: 'x', prescriptions: presc() }]),
      exerciseSlugs: new Set(['x']),
      imageFiles: new Set(['a.png']),
      exerciseImages: new Map([['x', 'a.png']]),
      pageSlugs: new Set(['safety', 'program']),
    });
    expect(errors.join('\n')).toMatch(/"program" collides with a reserved route/);
    expect(errors.filter((e) => e.includes('safety'))).toEqual([]);
  });
});
