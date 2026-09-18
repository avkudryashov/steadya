import { z } from 'astro/zod';
import { PHASE_IDS } from '@/content/schemas';
import { openDb, type Session, type Settings, type TestResult } from '@/lib/storage/db';
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

const setRecordSchema = z.object({
  done: z.boolean(),
  reps: z.number().optional(),
  load: z.string().optional(),
});

const sessionSchema = z.object({
  id: z.string(),
  date: z.string(),
  weekday: z.string(),
  programId: z.string(),
  phaseId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  items: z.array(z.object({ exerciseId: z.string(), sets: z.array(setRecordSchema) })),
});

const settingsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phaseOverride: z.union([z.literal('auto'), z.enum(PHASE_IDS)]),
  theme: z.enum(['system', 'light', 'dark']),
  sound: z.boolean(),
  lang: z.string(),
  schemaVersion: z.number(),
});

const testResultSchema = z.object({
  id: z.string(),
  testId: z.string(),
  date: z.string(),
  value: z.number(),
});

const exportFileSchema = z.object({
  app: z.literal('steadya'),
  version: z.number(),
  exportedAt: z.string(),
  settings: settingsSchema,
  sessions: z.array(sessionSchema),
  testResults: z.array(testResultSchema),
});

/** Parses and validates an export file, throwing a user-facing Russian error on a foreign or broken file. */
export function parseImport(text: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Не удалось прочитать файл: это не JSON');
  }
  const app = (data as { app?: unknown } | null)?.app;
  if (app !== 'steadya') throw new Error('Файл не от Steadya');
  const result = exportFileSchema.safeParse(data);
  if (!result.success) {
    throw new Error('Файл Steadya повреждён: нет занятий, тестов или настроек');
  }
  return result.data as ExportFile;
}

/**
 * Replaces all stored data with the given export file's contents in one atomic
 * transaction, rolling back on failure; rejects with {@link StorageUnavailableError}
 * when the browser has no usable IndexedDB.
 */
export async function applyImport(file: ExportFile): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(['settings', 'sessions', 'testResults'], 'readwrite');
    try {
      const settingsStore = tx.objectStore('settings');
      const sessionsStore = tx.objectStore('sessions');
      const testResultsStore = tx.objectStore('testResults');
      await settingsStore.clear();
      await sessionsStore.clear();
      await testResultsStore.clear();
      await settingsStore.put(file.settings, SETTINGS_KEY);
      for (const session of file.sessions) await sessionsStore.put(session);
      for (const result of file.testResults) await testResultsStore.put(result);
      await tx.done;
    } catch (err) {
      try {
        tx.abort();
      } catch {
        // already finished; nothing to abort
      }
      await tx.done.catch(() => undefined);
      throw err;
    }
  } finally {
    db.close();
  }
}
