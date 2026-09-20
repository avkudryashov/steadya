// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SetLogger from '@/islands/SetLogger';
import { clearAll } from '@/lib/storage/db';
import { getSession, sessionId } from '@/lib/storage/sessions';
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
const prescriptions = four({ sets: 2, reps: '10', step: 'base', restSec: 60 } as Prescription);

beforeEach(async () => {
  await clearAll();
  await saveSettings({ startDate: '2026-09-14', phaseOverride: 'auto' });
});

afterEach(() => {
  cleanup();
});

function renderLogger(overrides: Partial<Parameters<typeof SetLogger>[0]> = {}) {
  return render(
    <SetLogger
      lang="ru"
      weekday="monday"
      program={program}
      exerciseId="chair-squat"
      prescriptions={prescriptions}
      now={new Date(2026, 8, 14)}
      {...overrides}
    />,
  );
}

describe('SetLogger', () => {
  it('creates no session while the day sheet is just open', async () => {
    renderLogger();
    await screen.findByRole('button', { name: 'Подход 1' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await getSession(sessionId('2026-09-14', 'monday'))).toBeUndefined();
  });

  it('marks a set, starts the rest timer and persists across a reload', async () => {
    const first = renderLogger();
    fireEvent.click(await screen.findByRole('button', { name: 'Подход 1' }));
    await waitFor(async () => {
      const s = await getSession(sessionId('2026-09-14', 'monday'));
      expect(s?.items[0]?.sets[0]?.done).toBe(true);
    });
    expect(screen.getByRole('timer')).toBeTruthy();
    first.unmount();
    renderLogger();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Подход 1' }).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );
  });

  it('unmarks a set on a second tap without starting the timer', async () => {
    renderLogger();
    const setOne = await screen.findByRole('button', { name: 'Подход 1' });
    fireEvent.click(setOne);
    await waitFor(() => expect(setOne.getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(setOne);
    await waitFor(() => expect(setOne.getAttribute('aria-pressed')).toBe('false'));
    expect(screen.queryByRole('timer')).toBeNull();
    await waitFor(async () => {
      const s = await getSession(sessionId('2026-09-14', 'monday'));
      expect(s?.items[0]?.sets[0]?.done).toBe(false);
    });
  });

  it('applies the weight field to every set of the exercise', async () => {
    renderLogger();
    await screen.findByRole('button', { name: 'Подход 1' });
    fireEvent.input(screen.getByLabelText('Вес или лента'), {
      target: { value: 'лента красная' },
    });
    await waitFor(
      async () => {
        const s = await getSession(sessionId('2026-09-14', 'monday'));
        const item = s?.items.find((i) => i.exerciseId === 'chair-squat');
        expect(item?.sets.every((set) => set.load === 'лента красная')).toBe(true);
      },
      { timeout: 2000 },
    );
  });

  it('shows one set fewer on a deload week', async () => {
    // 2026-10-05 is 21 days after the 2026-09-14 start: week 4, a deload week.
    renderLogger({ now: new Date(2026, 9, 5) });
    await screen.findByRole('button', { name: 'Подход 1' });
    expect(screen.queryByRole('button', { name: 'Подход 2' })).toBeNull();
  });

  it('hides controls and shows the notice when storage is unavailable', async () => {
    const originalIndexedDB = globalThis.indexedDB;
    // @ts-expect-error simulate a browser without indexedDB support
    delete globalThis.indexedDB;
    try {
      renderLogger();
      await waitFor(() =>
        expect(screen.getByText('Записи не сохраняются на этом устройстве')).toBeTruthy(),
      );
      expect(screen.queryByRole('button', { name: 'Подход 1' })).toBeNull();
      expect(screen.queryByLabelText('Вес или лента')).toBeNull();
    } finally {
      globalThis.indexedDB = originalIndexedDB;
    }
  });
});
