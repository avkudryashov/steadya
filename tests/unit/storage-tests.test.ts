import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll } from '@/lib/storage/db';
import {
  getAllTestResults,
  getTestHistory,
  saveTestResult,
  testResultId,
} from '@/lib/storage/tests';

beforeEach(async () => {
  await clearAll();
});

describe('test results', () => {
  it('builds a stable id', () => {
    expect(testResultId('tug', '2026-09-14')).toBe('tug:2026-09-14');
  });
  it('overwrites the same test on the same day', async () => {
    await saveTestResult({ testId: 'tug', dateIso: '2026-09-14', value: 12 });
    await saveTestResult({ testId: 'tug', dateIso: '2026-09-14', value: 11 });
    const history = await getTestHistory('tug');
    expect(history).toHaveLength(1);
    expect(history[0]!.value).toBe(11);
  });
  it('lists history newest first and keeps tests apart', async () => {
    await saveTestResult({ testId: 'tug', dateIso: '2026-09-14', value: 12 });
    await saveTestResult({ testId: 'tug', dateIso: '2026-10-12', value: 10 });
    await saveTestResult({ testId: 'single-leg', dateIso: '2026-09-14', value: 8 });
    expect((await getTestHistory('tug')).map((r) => r.value)).toEqual([10, 12]);
    expect(await getAllTestResults()).toHaveLength(3);
  });
  it('rejects a value that is not a finite number', async () => {
    await expect(
      saveTestResult({ testId: 'tug', dateIso: '2026-09-14', value: Number.NaN }),
    ).rejects.toThrow(/value/);
  });
});
