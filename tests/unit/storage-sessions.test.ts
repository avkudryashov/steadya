import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll } from '@/lib/storage/db';
import {
  finishSession,
  getOrCreateSession,
  getSession,
  listSessions,
  markSet,
  sessionId,
  setExerciseFields,
  topSetsFor,
} from '@/lib/storage/sessions';

const base = {
  weekday: 'monday' as const,
  programId: 'women-70-plus',
  phaseId: 'p1' as const,
  plan: [
    { exerciseId: 'chair-squat', sets: 2 },
    { exerciseId: 'calf-raise', sets: 3 },
  ],
};

beforeEach(async () => {
  await clearAll();
});

describe('sessionId', () => {
  it('combines date and weekday', () => {
    expect(sessionId('2026-09-14', 'monday')).toBe('2026-09-14:monday');
  });
});

describe('getOrCreateSession', () => {
  it('creates empty sets from the plan', async () => {
    const s = await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    expect(s.id).toBe('2026-09-14:monday');
    expect(s.items).toHaveLength(2);
    expect(s.items[0]!.sets).toEqual([{ done: false }, { done: false }]);
    expect(s.items[1]!.sets).toHaveLength(3);
    expect(s.finishedAt).toBeUndefined();
  });
  it('returns the stored session with its marks on a second call', async () => {
    await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    await markSet('2026-09-14:monday', 'chair-squat', 0, { done: true, reps: 12 });
    const again = await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    expect(again.items[0]!.sets[0]).toEqual({ done: true, reps: 12 });
  });

  // Each exercise card on the day sheet mounts its own logger and only knows
  // its own plan, so a later card's first tap must add its item to the
  // session another card already created for the same day, not replace it.
  it('adds a missing exercise to a session another logger already created', async () => {
    await getOrCreateSession({
      dateIso: '2026-09-14',
      weekday: 'monday',
      programId: 'women-70-plus',
      phaseId: 'p1',
      plan: [{ exerciseId: 'chair-squat', sets: 2 }],
    });
    const withSecond = await getOrCreateSession({
      dateIso: '2026-09-14',
      weekday: 'monday',
      programId: 'women-70-plus',
      phaseId: 'p1',
      plan: [{ exerciseId: 'calf-raise', sets: 3 }],
    });
    expect(withSecond.items.map((i) => i.exerciseId)).toEqual(['chair-squat', 'calf-raise']);
    expect(withSecond.items[1]!.sets).toHaveLength(3);
  });
});

describe('markSet', () => {
  it('rejects an unknown exercise or index', async () => {
    await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    await expect(markSet('2026-09-14:monday', 'nope', 0, { done: true })).rejects.toThrow(/nope/);
    await expect(markSet('2026-09-14:monday', 'chair-squat', 9, { done: true })).rejects.toThrow(
      /9/,
    );
  });

  it('keeps both marks when two sets are recorded at once', async () => {
    await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    await Promise.all([
      markSet('2026-09-14:monday', 'chair-squat', 0, { done: true, reps: 10 }),
      markSet('2026-09-14:monday', 'chair-squat', 1, { done: true, reps: 11 }),
    ]);
    const s = await getSession('2026-09-14:monday');
    expect(s?.items[0]?.sets.map((x) => x.done)).toEqual([true, true]);
  });
});

describe('setExerciseFields', () => {
  it('applies reps and load to every set of the exercise', async () => {
    await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    const updated = await setExerciseFields('2026-09-14:monday', 'chair-squat', {
      reps: 10,
      load: 'лента красная',
    });
    const item = updated.items.find((i) => i.exerciseId === 'chair-squat');
    expect(item?.sets).toEqual([
      { done: false, reps: 10, load: 'лента красная' },
      { done: false, reps: 10, load: 'лента красная' },
    ]);
  });

  it('does not clear a done flag already set on a set', async () => {
    await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    await markSet('2026-09-14:monday', 'chair-squat', 0, { done: true });
    const updated = await setExerciseFields('2026-09-14:monday', 'chair-squat', { reps: 8 });
    expect(updated.items[0]!.sets[0]).toEqual({ done: true, reps: 8 });
  });

  it('rejects an unknown exercise', async () => {
    await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    await expect(setExerciseFields('2026-09-14:monday', 'nope', { reps: 8 })).rejects.toThrow(
      /nope/,
    );
  });
});

describe('finishSession and history', () => {
  it('stamps the finish time and lists sessions newest first', async () => {
    await getOrCreateSession({ ...base, dateIso: '2026-09-07' });
    await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    const done = await finishSession('2026-09-07:monday');
    expect(done.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const list = await listSessions();
    expect(list.map((s) => s.date)).toEqual(['2026-09-14', '2026-09-07']);
    expect((await getSession('2026-09-07:monday'))?.finishedAt).toBe(done.finishedAt);
  });
});

describe('topSetsFor', () => {
  it('returns the last completed set reps, newest first', async () => {
    await getOrCreateSession({ ...base, dateIso: '2026-09-07' });
    await markSet('2026-09-07:monday', 'chair-squat', 0, { done: true, reps: 10 });
    await markSet('2026-09-07:monday', 'chair-squat', 1, { done: true, reps: 11 });
    await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    await markSet('2026-09-14:monday', 'chair-squat', 0, { done: true, reps: 12 });
    expect(await topSetsFor('chair-squat', 2)).toEqual([12, 11]);
  });
  it('skips sessions without recorded reps', async () => {
    await getOrCreateSession({ ...base, dateIso: '2026-09-14' });
    await markSet('2026-09-14:monday', 'chair-squat', 0, { done: true });
    expect(await topSetsFor('chair-squat', 2)).toEqual([]);
  });
});
