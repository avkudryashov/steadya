import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll } from '@/lib/storage/db';
import { getSettings, saveSettings } from '@/lib/storage/settings';
import { getOrCreateSession, markSet } from '@/lib/storage/sessions';
import { saveTestResult } from '@/lib/storage/tests';
import { applyImport, buildExport, parseImport, toCsv } from '@/lib/storage/transfer';

beforeEach(async () => {
  await clearAll();
});

async function seed() {
  await saveSettings({ startDate: '2026-09-14', sound: false });
  await getOrCreateSession({
    dateIso: '2026-09-14',
    weekday: 'monday',
    programId: 'women-70-plus',
    phaseId: 'p1',
    plan: [{ exerciseId: 'chair-squat', sets: 2 }],
  });
  await markSet('2026-09-14:monday', 'chair-squat', 0, { done: true, reps: 12, load: '4 кг' });
  await saveTestResult({ testId: 'tug', dateIso: '2026-09-14', value: 11 });
}

describe('buildExport', () => {
  it('collects settings, sessions and test results', async () => {
    await seed();
    const file = await buildExport();
    expect(file.app).toBe('steadya');
    expect(file.settings.startDate).toBe('2026-09-14');
    expect(file.sessions).toHaveLength(1);
    expect(file.testResults).toHaveLength(1);
  });
});

describe('toCsv', () => {
  it('writes one row per set with a header', async () => {
    await seed();
    const file = await buildExport();
    const lines = toCsv(file.sessions).trim().split('\n');
    expect(lines[0]).toBe('date,weekday,phase,exercise,set,done,reps,load');
    expect(lines[1]).toBe('2026-09-14,monday,p1,chair-squat,1,yes,12,4 кг');
    expect(lines[2]).toBe('2026-09-14,monday,p1,chair-squat,2,no,,');
  });
  it('quotes a value containing a comma', () => {
    const csv = toCsv([
      {
        id: 'x',
        date: '2026-09-14',
        weekday: 'monday',
        programId: 'p',
        phaseId: 'p1',
        startedAt: '',
        items: [{ exerciseId: 'e', sets: [{ done: true, reps: 5, load: 'гантели 3, 4 кг' }] }],
      },
    ]);
    expect(csv).toContain('"гантели 3, 4 кг"');
  });
});

describe('parseImport and applyImport', () => {
  it('round trips an export', async () => {
    await seed();
    const text = JSON.stringify(await buildExport());
    await clearAll();
    await applyImport(parseImport(text));
    expect((await getSettings()).startDate).toBe('2026-09-14');
    expect((await buildExport()).sessions).toHaveLength(1);
  });
  it('rejects a foreign or broken file', () => {
    expect(() => parseImport('{')).toThrow(/не удалось прочитать/i);
    expect(() => parseImport('{"app":"other","version":1}')).toThrow(/steadya/i);
  });
  it('rejects a session missing items', async () => {
    await seed();
    const file = await buildExport();
    const broken = { ...file, sessions: [{ ...file.sessions[0], items: undefined }] };
    expect(() => parseImport(JSON.stringify(broken))).toThrow(/повреждён/i);
  });
  it('rejects a test result whose value is not a number', async () => {
    await seed();
    const file = await buildExport();
    const broken = {
      ...file,
      testResults: [{ ...file.testResults[0], value: 'oops' }],
    };
    expect(() => parseImport(JSON.stringify(broken))).toThrow(/повреждён/i);
  });
  it('leaves previous data intact when applyImport fails', async () => {
    await seed();
    const before = await buildExport();
    const broken = {
      ...before,
      sessions: [{ ...before.sessions[0], id: undefined as unknown as string }],
    };
    await expect(applyImport(broken)).rejects.toThrow();
    expect((await buildExport()).sessions).toHaveLength(1);
    expect((await buildExport()).sessions[0]!.id).toBe(before.sessions[0]!.id);
  });
});
