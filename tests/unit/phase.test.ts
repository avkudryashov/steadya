import { describe, expect, it } from 'vitest';
import {
  isDeloadWeek,
  phaseForWeek,
  resolvePhase,
  weekFromStart,
  type ProgramMeta,
} from '@/lib/phase';
import type { Program } from '@/content/schemas';

const fullProgram: Program = {
  id: 'p',
  title: 't',
  audience: 'a',
  weeks: 12,
  phases: [
    { id: 'p1', weeks: [1, 2], label: 'Недели 1–2', goal: 'g', strength: 's', balance: 'b' },
    { id: 'p2', weeks: [3, 4], label: 'Недели 3–4', goal: 'g', strength: 's', balance: 'b' },
    { id: 'p3', weeks: [5, 8], label: 'Недели 5–8', goal: 'g', strength: 's', balance: 'b' },
    { id: 'p4', weeks: [9, 12], label: 'Недели 9–12', goal: 'g', strength: 's', balance: 'b' },
  ],
  deloadWeeks: [4, 8, 12],
  warmup: [],
  cooldown: [],
  daily: [],
  days: [],
};
// `fullProgram` is a real `Program`; assigning it here proves it satisfies
// `ProgramMeta` structurally, with no cast.
const program = fullProgram satisfies ProgramMeta;

describe('weekFromStart', () => {
  it('counts the start day as week 1', () => {
    expect(weekFromStart('2026-09-14', '2026-09-14')).toBe(1);
    expect(weekFromStart('2026-09-14', '2026-09-20')).toBe(1);
    expect(weekFromStart('2026-09-14', '2026-09-21')).toBe(2);
  });
  it('never returns less than 1 for a future start', () => {
    expect(weekFromStart('2026-09-14', '2026-09-01')).toBe(1);
  });
});

describe('phaseForWeek', () => {
  it('maps weeks to phases', () => {
    expect(phaseForWeek(program, 1)).toBe('p1');
    expect(phaseForWeek(program, 4)).toBe('p2');
    expect(phaseForWeek(program, 7)).toBe('p3');
    expect(phaseForWeek(program, 12)).toBe('p4');
  });
  it('clamps past the last week to the last phase', () => {
    expect(phaseForWeek(program, 30)).toBe('p4');
  });
});

describe('isDeloadWeek', () => {
  it('knows the lighter weeks', () => {
    expect(isDeloadWeek(program, 4)).toBe(true);
    expect(isDeloadWeek(program, 5)).toBe(false);
  });
});

describe('resolvePhase', () => {
  it('computes week and phase from the start date', () => {
    expect(
      resolvePhase(program, {
        startDate: '2026-09-14',
        phaseOverride: 'auto',
        dateIso: '2026-10-20',
      }),
    ).toEqual({ week: 6, phase: 'p3', deload: false, beyondProgram: false });
  });
  it('honours a manual override but keeps the real week', () => {
    expect(
      resolvePhase(program, {
        startDate: '2026-09-14',
        phaseOverride: 'p1',
        dateIso: '2026-10-20',
      }),
    ).toEqual({ week: 6, phase: 'p1', deload: false, beyondProgram: false });
  });
  it('flags weeks past the programme end', () => {
    const r = resolvePhase(program, {
      startDate: '2026-01-01',
      phaseOverride: 'auto',
      dateIso: '2026-09-18',
    });
    expect(r.beyondProgram).toBe(true);
    expect(r.phase).toBe('p4');
  });
});
