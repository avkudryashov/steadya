// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import TodayCard from '@/islands/TodayCard';
import { clearAll } from '@/lib/storage/db';
import { saveSettings } from '@/lib/storage/settings';
import type { ProgramMeta } from '@/lib/phase';
import type { Weekday } from '@/content/schemas';

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
const days = [
  {
    weekday: 'monday' as Weekday,
    title: 'Силовая A',
    durationMin: 60,
    kind: 'strength',
    hasBlocks: true,
  },
  { weekday: 'sunday' as Weekday, title: 'Отдых', durationMin: 0, kind: 'rest', hasBlocks: false },
  {
    weekday: 'wednesday' as Weekday,
    title: 'Ходьба',
    durationMin: 45,
    kind: 'walk',
    hasBlocks: false,
  },
];
const links = {
  monday: '/ru/day/monday/',
  sunday: '/ru/day/sunday/',
  wednesday: '/ru/day/wednesday/',
} as Record<Weekday, string>;
const sessions = {
  monday: '/ru/day/monday/session/',
  sunday: '/ru/day/sunday/session/',
  wednesday: '/ru/day/wednesday/session/',
} as Record<Weekday, string>;

beforeEach(async () => {
  await clearAll();
});

afterEach(() => {
  cleanup();
});

describe('TodayCard', () => {
  it('shows the training day, week and start button', async () => {
    await saveSettings({ startDate: '2026-09-14' });
    render(
      <TodayCard
        lang="ru"
        program={program}
        days={days}
        dayLinks={links}
        sessionLinks={sessions}
        now={new Date(2026, 8, 14)}
      />,
    );
    expect(screen.getByText('Силовая A')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Неделя 1 из 12/)).toBeTruthy());
    expect(screen.getByText(/Недели 1–2/)).toBeTruthy();
    const start = screen.getByRole('link', { name: 'Начать занятие' });
    expect(start.getAttribute('href')).toBe('/ru/day/monday/session/');
  });

  it('shows a rest day without a start button', async () => {
    await saveSettings({ startDate: '2026-09-14' });
    render(
      <TodayCard
        lang="ru"
        program={program}
        days={days}
        dayLinks={links}
        sessionLinks={sessions}
        now={new Date(2026, 8, 20)}
      />,
    );
    await waitFor(() => expect(screen.getByText('Сегодня отдых')).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'Начать занятие' })).toBeNull();
  });

  it('marks a deload week', async () => {
    await saveSettings({ startDate: '2026-09-14' });
    render(
      <TodayCard
        lang="ru"
        program={program}
        days={days}
        dayLinks={links}
        sessionLinks={sessions}
        now={new Date(2026, 9, 5)}
      />,
    );
    await waitFor(() => expect(screen.getByText(/Лёгкая неделя/)).toBeTruthy());
  });

  it('shows no start button on a day with no session', async () => {
    await saveSettings({ startDate: '2026-09-14' });
    render(
      <TodayCard
        lang="ru"
        program={program}
        days={days}
        dayLinks={links}
        sessionLinks={sessions}
        now={new Date(2026, 8, 16)}
      />,
    );
    await waitFor(() => expect(screen.getByText('Ходьба')).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'Начать занятие' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Открыть день' })).toBeTruthy();
  });

  it('shows a notice instead of week/phase when storage is unavailable', async () => {
    const originalIndexedDB = globalThis.indexedDB;
    // @ts-expect-error simulate a browser without indexedDB support
    delete globalThis.indexedDB;
    try {
      render(
        <TodayCard
          lang="ru"
          program={program}
          days={days}
          dayLinks={links}
          sessionLinks={sessions}
          now={new Date(2026, 8, 14)}
        />,
      );
      await waitFor(() =>
        expect(screen.getByText('Записи не сохраняются на этом устройстве')).toBeTruthy(),
      );
      expect(screen.getByText('Силовая A')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Начать занятие' })).toBeTruthy();
      expect(screen.queryByText(/Неделя/)).toBeNull();
    } finally {
      globalThis.indexedDB = originalIndexedDB;
    }
  });
});
