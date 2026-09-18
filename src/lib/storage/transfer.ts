import { clearAll, openDb, type Session, type Settings, type TestResult } from '@/lib/storage/db';
import { DB_VERSION, SETTINGS_KEY } from '@/lib/storage/db';
import { getSettings } from '@/lib/storage/settings';
import { listSessions } from '@/lib/storage/sessions';
import { getAllTestResults } from '@/lib/storage/tests';

export interface ExportFile {
  app: 'steadya';
  version: number;
  exportedAt: string;
  settings: Settings;
  sessions: Session[];
  testResults: TestResult[];
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function buildExport(): Promise<ExportFile> {
  return {
    app: 'steadya',
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    settings: await getSettings(),
    sessions: await listSessions(),
    testResults: await getAllTestResults(),
  };
}

function cell(value: string | number | undefined): string {
  const s = value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Renders sessions as one CSV row per set, with a header row. */
export function toCsv(sessions: Session[]): string {
  const rows = ['date,weekday,phase,exercise,set,done,reps,load'];
  for (const session of sessions) {
    for (const item of session.items) {
      item.sets.forEach((set, i) => {
        rows.push(
          [
            session.date,
            session.weekday,
            session.phaseId,
            item.exerciseId,
            i + 1,
            set.done ? 'yes' : 'no',
            set.reps,
            set.load,
          ]
            .map(cell)
            .join(','),
        );
      });
    }
  }
  return `${rows.join('\n')}\n`;
}

/** Parses and validates an export file, throwing a user-facing Russian error on a foreign or broken file. */
export function parseImport(text: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Не удалось прочитать файл: это не JSON');
  }
  const file = data as Partial<ExportFile>;
  if (file.app !== 'steadya') throw new Error('Файл не от Steadya');
  if (!Array.isArray(file.sessions) || !Array.isArray(file.testResults) || !file.settings) {
    throw new Error('Файл Steadya повреждён: нет занятий, тестов или настроек');
  }
  return file as ExportFile;
}

/** Replaces all stored data with the given export file's contents; rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function applyImport(file: ExportFile): Promise<void> {
  await clearAll();
  const db = await openDb();
  const tx = db.transaction(['settings', 'sessions', 'testResults'], 'readwrite');
  await tx.objectStore('settings').put(file.settings, SETTINGS_KEY);
  for (const session of file.sessions) await tx.objectStore('sessions').put(session);
  for (const result of file.testResults) await tx.objectStore('testResults').put(result);
  await tx.done;
  db.close();
}
