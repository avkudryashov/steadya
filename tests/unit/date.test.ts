import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, todayIso, weekdayOf } from '@/lib/date';

describe('todayIso', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 8, 18, 23, 30))).toBe('2026-09-18');
  });
  it('does not shift a date across midnight in a positive offset', () => {
    expect(todayIso(new Date(2026, 0, 1, 0, 15))).toBe('2026-01-01');
  });
});

describe('weekdayOf', () => {
  it('maps ISO dates to weekday ids', () => {
    expect(weekdayOf('2026-09-14')).toBe('monday');
    expect(weekdayOf('2026-09-20')).toBe('sunday');
  });
  it('throws on a malformed date', () => {
    expect(() => weekdayOf('18.09.2026')).toThrow(/YYYY-MM-DD/);
  });
});

describe('addDays and daysBetween', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('counts whole days', () => {
    expect(daysBetween('2026-09-01', '2026-09-15')).toBe(14);
    expect(daysBetween('2026-09-15', '2026-09-01')).toBe(-14);
    expect(daysBetween('2026-09-15', '2026-09-15')).toBe(0);
  });
});
