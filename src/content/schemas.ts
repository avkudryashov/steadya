import { z } from 'astro/zod';

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const PHASE_IDS = ['p1', 'p2', 'p3', 'p4'] as const;
export type PhaseId = (typeof PHASE_IDS)[number];

export const STEP_IDS = ['base', 'working', 'advanced'] as const;
export type StepId = (typeof STEP_IDS)[number];

export const CATEGORIES = [
  'strength',
  'power',
  'balance',
  'mobility',
  'core',
  'posture',
  'breathing',
] as const;

export const EQUIPMENT = [
  'none',
  'chair',
  'wall',
  'mat',
  'dumbbells',
  'longBand',
  'miniBand',
  'step',
  'roller',
  'backpack',
  'pillow',
] as const;

export const DAY_KINDS = ['strength', 'balance', 'posture', 'walk', 'optional', 'rest'] as const;

const stepSchema = z.object({
  description: z.string().min(5),
  load: z.string().optional(),
});

export const exerciseBaseSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(3),
  shortCue: z.string().min(10),
  imageAlt: z.string().min(10),
  category: z.enum(CATEGORIES),
  muscles: z.array(z.string()).min(1),
  equipment: z.array(z.enum(EQUIPMENT)).min(1),
  steps: z.object({ base: stepSchema, working: stepSchema, advanced: stepSchema }),
  technique: z.array(z.string().min(5)).min(3).max(6),
  mistakes: z.array(z.string().min(5)).min(1),
  stopSigns: z.array(z.string().min(5)).min(1),
  osteoporosisNote: z.string().optional(),
});
export type ExerciseBase = z.infer<typeof exerciseBaseSchema>;

export const prescriptionSchema = z
  .object({
    sets: z.number().int().min(1).max(6),
    reps: z.string().min(1).optional(),
    seconds: z.number().int().min(5).optional(),
    step: z.enum(STEP_IDS),
    load: z.string().optional(),
    restSec: z.number().int().min(0).max(300).default(60),
    note: z.string().optional(),
  })
  .refine((p) => p.reps !== undefined || p.seconds !== undefined, {
    message: 'prescription needs reps or seconds',
  });
export type Prescription = z.infer<typeof prescriptionSchema>;

const prescriptionsSchema = z
  .record(z.enum(PHASE_IDS), prescriptionSchema)
  .refine((r) => PHASE_IDS.every((p) => p in r), {
    message: `prescriptions must cover phases ${PHASE_IDS.join(', ')}`,
  });

const exerciseItemSchema = z.object({
  exercise: z.string().regex(/^[a-z0-9-]+$/),
  prescriptions: prescriptionsSchema,
});
const textItemSchema = z.object({
  text: z.string().min(5),
  minutes: z.number().min(0).optional(),
  byPhase: z.record(z.enum(PHASE_IDS), z.string()).optional(),
});
export const programItemSchema = z.union([exerciseItemSchema, textItemSchema]);
export type ProgramItem = z.infer<typeof programItemSchema>;
export type ExerciseItem = z.infer<typeof exerciseItemSchema>;

export function isExerciseItem(item: ProgramItem): item is ExerciseItem {
  return 'exercise' in item;
}

export const programBlockSchema = z.object({
  title: z.string().min(3),
  minutesFrom: z.number().int().min(0),
  minutesTo: z.number().int().min(1),
  items: z.array(programItemSchema).min(1),
});
export type ProgramBlock = z.infer<typeof programBlockSchema>;

export const programDaySchema = z.object({
  weekday: z.enum(WEEKDAYS),
  kind: z.enum(DAY_KINDS),
  title: z.string().min(3),
  durationMin: z.number().int().min(0),
  blocks: z.array(programBlockSchema),
  note: z.string().optional(),
});
export type ProgramDay = z.infer<typeof programDaySchema>;

export const programSchema = z.object({
  id: z.string(),
  title: z.string(),
  audience: z.string(),
  weeks: z.number().int().min(1),
  phases: z
    .array(
      z.object({ id: z.enum(PHASE_IDS), weeks: z.tuple([z.number().int(), z.number().int()]) }),
    )
    .length(PHASE_IDS.length),
  deloadWeeks: z.array(z.number().int()),
  warmup: z.array(z.object({ text: z.string(), minutes: z.number() })),
  cooldown: z.array(z.object({ text: z.string(), minutes: z.number() })),
  daily: z.array(z.object({ text: z.string(), exceptWeekdays: z.array(z.enum(WEEKDAYS)) })),
  days: z
    .array(programDaySchema)
    .length(7)
    .refine((days) => WEEKDAYS.every((w) => days.some((d) => d.weekday === w)), {
      message: 'program must define all seven weekdays',
    }),
});
export type Program = z.infer<typeof programSchema>;

export const testSchema = z.object({
  id: z.string(),
  title: z.string(),
  howTo: z.string(),
  unit: z.string(),
  thresholdNote: z.string(),
  meaning: z.string(),
  direction: z.enum(['higherBetter', 'lowerBetter']),
});
export type TestDef = z.infer<typeof testSchema>;

export const pageSchema = z.object({
  title: z.string(),
  description: z.string(),
  order: z.number().int(),
});
