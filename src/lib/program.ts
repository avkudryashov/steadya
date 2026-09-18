import type { Lang } from '@/i18n/locales';
import { t } from '@/i18n/t';
import {
  isExerciseItem,
  type Prescription,
  type Program,
  type ProgramDay,
  type Weekday,
} from '@/content/schemas';

export function findDay(program: Program, weekday: Weekday): ProgramDay {
  const day = program.days.find((d) => d.weekday === weekday);
  if (!day) throw new Error(`program ${program.id} has no day ${weekday}`);
  return day;
}

export function exerciseSlugsOfDay(day: ProgramDay): string[] {
  const seen = new Set<string>();
  for (const block of day.blocks) {
    for (const item of block.items) {
      if (isExerciseItem(item)) seen.add(item.exercise);
    }
  }
  return Array.from(seen);
}

export function exerciseSlugsOfProgram(program: Program): string[] {
  const seen = new Set<string>();
  for (const day of program.days) for (const s of exerciseSlugsOfDay(day)) seen.add(s);
  return Array.from(seen);
}

export function daysUsingExercise(program: Program, slug: string): Weekday[] {
  return program.days.filter((d) => exerciseSlugsOfDay(d).includes(slug)).map((d) => d.weekday);
}

export function blockMinutesTotal(day: ProgramDay): number {
  return day.blocks.reduce((sum, b) => sum + (b.minutesTo - b.minutesFrom), 0);
}

export function formatPrescription(p: Prescription, lang: Lang): string {
  if (p.seconds !== undefined)
    return t(lang, 'exercise.sets_seconds', { sets: p.sets, seconds: p.seconds });
  return t(lang, 'exercise.sets_reps', { sets: p.sets, reps: p.reps ?? '' });
}
