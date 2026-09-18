import { describe, expect, it } from 'vitest';
import { exerciseBaseSchema, programSchema, prescriptionSchema } from '@/content/schemas';

const exercise = {
  slug: 'chair-squat',
  title: 'Приседание на стул',
  shortCue: 'Таз назад и вниз, колени по направлению носков, спина прямая',
  imageAlt: 'Женщина приседает над стулом, руки вперёд',
  category: 'strength',
  muscles: ['ягодицы', 'квадрицепсы'],
  equipment: ['chair', 'dumbbells'],
  steps: {
    base: { description: 'На стул, касаясь сиденьем, руки вперёд' },
    working: { description: 'С гантелью у груди над стулом', load: 'гантель 4–6 кг' },
    advanced: { description: 'Кубковое без стула', load: 'гантель 8–12 кг' },
  },
  technique: ['Ноги чуть шире таза', 'Таз идёт назад и вниз', 'Вставать, давя пятками в пол'],
  mistakes: ['Колени сводятся внутрь'],
  stopSigns: ['Боль в колене выше 3 из 10'],
};

describe('exerciseBaseSchema', () => {
  it('accepts a full exercise', () => {
    expect(exerciseBaseSchema.parse(exercise).slug).toBe('chair-squat');
  });
  it('rejects unknown equipment and short technique', () => {
    expect(() => exerciseBaseSchema.parse({ ...exercise, equipment: ['door'] })).toThrow();
    expect(() => exerciseBaseSchema.parse({ ...exercise, technique: ['одна строка'] })).toThrow();
  });
});

describe('prescriptionSchema', () => {
  it('requires reps or seconds', () => {
    expect(prescriptionSchema.parse({ sets: 3, reps: '8–12', step: 'working' }).sets).toBe(3);
    expect(prescriptionSchema.parse({ sets: 2, seconds: 30, step: 'base' }).seconds).toBe(30);
    expect(() => prescriptionSchema.parse({ sets: 3, step: 'base' })).toThrow();
  });
});

describe('programSchema', () => {
  it('requires all seven weekdays and all four phases in prescriptions', () => {
    const day = (weekday: string) => ({
      weekday,
      kind: 'rest',
      title: 'Отдых',
      durationMin: 0,
      blocks: [],
    });
    const base = {
      id: 'women-70-plus',
      title: 'Программа',
      audience: 'women-70-plus',
      weeks: 12,
      phases: [
        { id: 'p1', weeks: [1, 2] },
        { id: 'p2', weeks: [3, 4] },
        { id: 'p3', weeks: [5, 8] },
        { id: 'p4', weeks: [9, 12] },
      ],
      deloadWeeks: [4, 8, 12],
      warmup: [{ text: 'Ходьба на месте', minutes: 2 }],
      cooldown: [{ text: 'Медленная ходьба', minutes: 2 }],
      daily: [{ text: 'Ходьба 30 минут', exceptWeekdays: [] }],
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day),
    };
    expect(programSchema.parse(base).days).toHaveLength(7);
    expect(() => programSchema.parse({ ...base, days: base.days.slice(1) })).toThrow();
    const withItem = {
      ...base,
      days: base.days.map((d, i) =>
        i === 0
          ? {
              ...d,
              kind: 'strength',
              durationMin: 55,
              blocks: [
                {
                  title: 'Ноги',
                  minutesFrom: 8,
                  minutesTo: 15,
                  items: [
                    {
                      exercise: 'chair-squat',
                      prescriptions: { p1: { sets: 2, reps: '10', step: 'base' } },
                    },
                  ],
                },
              ],
            }
          : d,
      ),
    };
    expect(() => programSchema.parse(withItem)).toThrow(/p2/);
  });
});
