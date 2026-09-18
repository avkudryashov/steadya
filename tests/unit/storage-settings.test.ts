import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAll,
  DB_VERSION,
  isStorageAvailable,
  openDb,
  StorageUnavailableError,
} from '@/lib/storage/db';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '@/lib/storage/settings';

beforeEach(async () => {
  await clearAll();
});

describe('database', () => {
  it('opens at the declared version with all stores', async () => {
    const db = await openDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['sessions', 'settings', 'testResults']);
    db.close();
  });
});

describe('settings', () => {
  it('returns defaults before anything is saved', async () => {
    const s = await getSettings();
    expect(s.phaseOverride).toBe('auto');
    expect(s.theme).toBe('system');
    expect(s.sound).toBe(true);
    expect(s.lang).toBe('ru');
    expect(s.startDate).toBe(DEFAULT_SETTINGS.startDate);
  });
  it('merges a patch and keeps the rest', async () => {
    await saveSettings({ startDate: '2026-09-14' });
    const s = await saveSettings({ sound: false });
    expect(s.startDate).toBe('2026-09-14');
    expect(s.sound).toBe(false);
    expect((await getSettings()).startDate).toBe('2026-09-14');
  });
  it('rejects an unknown phase override', async () => {
    await expect(saveSettings({ phaseOverride: 'p9' as never })).rejects.toThrow(/phaseOverride/);
  });
});

describe('storage unavailable', () => {
  const realIndexedDB = globalThis.indexedDB;
  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', { value: realIndexedDB, configurable: true });
  });
  it('reports missing storage', () => {
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
    expect(isStorageAvailable()).toBe(false);
  });
  it('rejects reads and writes with StorageUnavailableError', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
    await expect(getSettings()).rejects.toBeInstanceOf(StorageUnavailableError);
    await expect(saveSettings({ sound: false })).rejects.toBeInstanceOf(StorageUnavailableError);
  });
});
