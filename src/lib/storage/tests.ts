import { openDb, type TestResult } from '@/lib/storage/db';

/** Builds the test result id from the test id and the date. */
export function testResultId(testId: string, dateIso: string): string {
  return `${testId}:${dateIso}`;
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function saveTestResult(input: {
  testId: string;
  dateIso: string;
  value: number;
}): Promise<TestResult> {
  if (!Number.isFinite(input.value)) throw new Error('value must be a finite number');
  const record: TestResult = {
    id: testResultId(input.testId, input.dateIso),
    testId: input.testId,
    date: input.dateIso,
    value: input.value,
  };
  const db = await openDb();
  await db.put('testResults', record);
  db.close();
  return record;
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function getAllTestResults(): Promise<TestResult[]> {
  const db = await openDb();
  const all = await db.getAll('testResults');
  db.close();
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function getTestHistory(testId: string): Promise<TestResult[]> {
  const all = await getAllTestResults();
  return all.filter((r) => r.testId === testId);
}
