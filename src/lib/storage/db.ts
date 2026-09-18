import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PhaseId, Weekday } from '@/content/schemas';
import type { Lang } from '@/i18n/locales';

export const DB_NAME = 'steadya';
export const DB_VERSION = 1;
export const SETTINGS_KEY = 'app';

export interface SetRecord {
  done: boolean;
  reps?: number;
  load?: string;
}

export interface SessionItem {
  exerciseId: string;
  sets: SetRecord[];
}

export interface Session {
  id: string;
  date: string;
  weekday: Weekday;
  programId: string;
  phaseId: PhaseId;
  items: SessionItem[];
  startedAt: string;
  finishedAt?: string;
}

export interface TestResult {
  id: string;
  testId: string;
  date: string;
  value: number;
}

export interface Settings {
  startDate: string;
  phaseOverride: PhaseId | 'auto';
  theme: 'system' | 'light' | 'dark';
  sound: boolean;
  lang: Lang;
  schemaVersion: number;
}

export interface SteadyaSchema extends DBSchema {
  settings: { key: string; value: Settings };
  sessions: { key: string; value: Session; indexes: { 'by-date': string } };
  testResults: { key: string; value: TestResult; indexes: { 'by-test': string } };
}

export function isStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

/** Thrown by any storage helper when IndexedDB is unavailable or fails to open. */
export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('storage unavailable');
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

/**
 * Rejects with {@link StorageUnavailableError} when the browser has no usable
 * IndexedDB, or when opening it fails for any other reason.
 */
export async function openDb(): Promise<IDBPDatabase<SteadyaSchema>> {
  if (!isStorageAvailable()) {
    throw new StorageUnavailableError();
  }
  try {
    return await openDB<SteadyaSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('by-date', 'date');
        }
        if (!db.objectStoreNames.contains('testResults')) {
          const store = db.createObjectStore('testResults', { keyPath: 'id' });
          store.createIndex('by-test', 'testId');
        }
      },
    });
  } catch (err) {
    throw new StorageUnavailableError(err);
  }
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function clearAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['settings', 'sessions', 'testResults'], 'readwrite');
  await Promise.all([
    tx.objectStore('settings').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('testResults').clear(),
    tx.done,
  ]);
  db.close();
}
