// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import PhaseFilter from '@/islands/PhaseFilter';
import { clearAll } from '@/lib/storage/db';
import { getSettings, saveSettings } from '@/lib/storage/settings';

const phases = [
  { id: 'p1' as const, label: 'Недели 1–2' },
  { id: 'p3' as const, label: 'Недели 5–8' },
];

beforeEach(async () => {
  await clearAll();
  document.documentElement.removeAttribute('data-phase');
});

afterEach(() => {
  cleanup();
});

describe('PhaseFilter', () => {
  it('applies the stored phase on mount', async () => {
    await saveSettings({ phaseOverride: 'p3' });
    render(<PhaseFilter lang="ru" phases={phases} />);
    await waitFor(() => expect(document.documentElement.dataset.phase).toBe('p3'));
  });

  it('switches the phase and stores the choice', async () => {
    render(<PhaseFilter lang="ru" phases={phases} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Недели 1–2' }));
    await waitFor(() => expect(document.documentElement.dataset.phase).toBe('p1'));
    await waitFor(async () => expect((await getSettings()).phaseOverride).toBe('p1'));
  });

  it('shows all phases again', async () => {
    await saveSettings({ phaseOverride: 'p1' });
    render(<PhaseFilter lang="ru" phases={phases} />);
    await waitFor(() => expect(document.documentElement.dataset.phase).toBe('p1'));
    fireEvent.click(screen.getByRole('button', { name: 'Все фазы' }));
    await waitFor(() => expect(document.documentElement.dataset.phase).toBeUndefined());
  });
});
