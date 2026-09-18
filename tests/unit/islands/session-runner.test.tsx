// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SessionRunner, { type SessionStep } from '@/islands/SessionRunner';
import { clearAll } from '@/lib/storage/db';
import { getSession } from '@/lib/storage/sessions';
import { saveSettings } from '@/lib/storage/settings';
import type { Prescription } from '@/content/schemas';
import type { ProgramMeta } from '@/lib/phase';

const program = {
  id: 'women-70-plus',
  weeks: 12,
  deloadWeeks: [4, 8, 12],
  phases: [
    { id: 'p1', weeks: [1, 2], label: 'Недели 1–2', goal: '', strength: '', balance: '' },
    { id: 'p2', weeks: [3, 4], label: 'Недели 3–4', goal: '', strength: '', balance: '' },
    { id: 'p3', weeks: [5, 8], label: 'Недели 5–8', goal: '', strength: '', balance: '' },
    { id: 'p4', weeks: [9, 12], label: 'Недели 9–12', goal: '', strength: '', balance: '' },
  ],
} satisfies ProgramMeta;

const four = (p: Prescription) => ({ p1: p, p2: p, p3: p, p4: p });

const steps: SessionStep[] = [
  {
    exerciseId: 'chair-squat',
    title: 'Приседание на стул',
    imageSrc: '/img/a.webp',
    imageAlt: 'Женщина приседает',
    cue: 'Таз назад и вниз',
    technique: ['Ноги чуть шире таза'],
    stopSigns: ['Боль в колене выше 3 из 10'],
    prescriptions: four({ sets: 2, reps: '10', step: 'base', restSec: 60 }),
  },
  {
    exerciseId: 'calf-raise',
    title: 'Подъём на носки',
    imageSrc: '/img/b.webp',
    imageAlt: 'Женщина на носках',
    cue: 'Пятки высоко',
    technique: ['Опускание медленное'],
    stopSigns: ['Судорога в икре'],
    prescriptions: four({ sets: 1, seconds: 30, step: 'base', restSec: 45 }),
  },
];

beforeEach(async () => {
  await clearAll();
  await saveSettings({ startDate: '2026-09-14', phaseOverride: 'auto' });
});

afterEach(() => {
  cleanup();
});

function renderRunner(customSteps: SessionStep[] = steps) {
  return render(
    <SessionRunner
      lang="ru"
      weekday="monday"
      program={program}
      steps={customSteps}
      dayLink="/ru/day/monday/"
      now={new Date(2026, 8, 14)}
    />,
  );
}

describe('SessionRunner', () => {
  it('shows the first step with its prescription and stop signs', async () => {
    renderRunner();
    await waitFor(() => expect(screen.getByText('Приседание на стул')).toBeTruthy());
    expect(screen.getByText(/Шаг 1 из 2/)).toBeTruthy();
    expect(screen.getByText(/Подход 1 из 2/)).toBeTruthy();
    expect(screen.getByText('Боль в колене выше 3 из 10')).toBeTruthy();
  });

  it('records a set and persists it', async () => {
    renderRunner();
    const button = await screen.findByRole('button', { name: 'Сделала подход' });
    fireEvent.click(button);
    await waitFor(async () => {
      const s = await getSession('2026-09-14:monday');
      expect(s?.items[0]?.sets[0]?.done).toBe(true);
    });
    expect(screen.getByText(/Подход 2 из 2/)).toBeTruthy();
  });

  it('moves between steps and finishes the session', async () => {
    renderRunner();
    fireEvent.click(await screen.findByRole('button', { name: 'Дальше' }));
    await waitFor(() => expect(screen.getByText('Подъём на носки')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Завершить занятие' }));
    await waitFor(async () => {
      const s = await getSession('2026-09-14:monday');
      expect(s?.finishedAt).toBeTruthy();
    });
    expect(screen.getByText('Занятие завершено')).toBeTruthy();
  });

  it('keeps marks after a remount', async () => {
    const first = renderRunner();
    fireEvent.click(await screen.findByRole('button', { name: 'Сделала подход' }));
    await waitFor(async () =>
      expect((await getSession('2026-09-14:monday'))?.items[0]?.sets[0]?.done).toBe(true),
    );
    first.unmount();
    renderRunner();
    await waitFor(() => expect(screen.getByText(/Подход 2 из 2/)).toBeTruthy());
  });

  it('still shows the step when storage is unavailable, without set controls', async () => {
    const originalIndexedDB = globalThis.indexedDB;
    // @ts-expect-error simulate a browser without indexedDB support
    delete globalThis.indexedDB;
    try {
      renderRunner();
      await waitFor(() =>
        expect(screen.getByText('Записи не сохраняются на этом устройстве')).toBeTruthy(),
      );
      expect(screen.getByText('Приседание на стул')).toBeTruthy();
      expect(screen.getByAltText('Женщина приседает')).toBeTruthy();
      expect(screen.getByText('Ноги чуть шире таза')).toBeTruthy();
      expect(screen.getByText('Боль в колене выше 3 из 10')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Сделала подход' })).toBeNull();
      expect(screen.queryByLabelText('Сколько повторений получилось')).toBeNull();
    } finally {
      globalThis.indexedDB = originalIndexedDB;
    }
  });

  // F1: a value typed for one exercise must not be recorded against the next one.
  it('does not leak typed reps and load into the next exercise', async () => {
    renderRunner();
    await screen.findByRole('button', { name: 'Сделала подход' });
    fireEvent.input(screen.getByLabelText('Сколько повторений получилось'), {
      target: { value: '12' },
    });
    fireEvent.input(screen.getByLabelText('Вес или лента'), {
      target: { value: 'лента красная' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    await waitFor(() => expect(screen.getByText('Подъём на носки')).toBeTruthy());
    fireEvent.click(await screen.findByRole('button', { name: 'Сделала подход' }));
    await waitFor(async () => {
      const s = await getSession('2026-09-14:monday');
      const item = s?.items.find((i) => i.exerciseId === 'calf-raise');
      expect(item?.sets[0]?.done).toBe(true);
    });
    const session = await getSession('2026-09-14:monday');
    const item = session?.items.find((i) => i.exerciseId === 'calf-raise');
    expect(item?.sets[0]?.reps).toBeUndefined();
    expect(item?.sets[0]?.load).toBeUndefined();
  });

  // F2: the set button is unavailable during rest, and each rest starts from
  // the full duration rather than continuing a previous countdown.
  it('hides the set button during rest and gives every rest its full duration', async () => {
    const restValue = () => document.querySelector('.rest-value')?.textContent;
    const shortRest: SessionStep[] = [
      {
        exerciseId: 'chair-squat',
        title: 'Приседание на стул',
        imageSrc: '/img/a.webp',
        imageAlt: 'Женщина приседает',
        cue: 'Таз назад и вниз',
        technique: ['Ноги чуть шире таза'],
        stopSigns: ['Боль в колене выше 3 из 10'],
        prescriptions: four({ sets: 2, reps: '10', step: 'base', restSec: 2 }),
      },
    ];
    renderRunner(shortRest);
    fireEvent.click(await screen.findByRole('button', { name: 'Сделала подход' }));
    expect(await screen.findByText('2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Сделала подход' })).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(Number(restValue())).toBeLessThan(2);
    fireEvent.click(screen.getByRole('button', { name: 'Пропустить отдых' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Сделала подход' }));
    expect(await screen.findByText('2')).toBeTruthy();
  });
});
