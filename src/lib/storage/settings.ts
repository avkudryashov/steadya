import { PHASE_IDS } from '@/content/schemas';
import { todayIso } from '@/lib/date';
import { DB_VERSION, openDb, SETTINGS_KEY, type Settings } from '@/lib/storage/db';

export const DEFAULT_SETTINGS: Settings = {
  startDate: todayIso(),
  phaseOverride: 'auto',
  theme: 'system',
  sound: true,
  lang: 'ru',
  schemaVersion: DB_VERSION,
};

function validate(patch: Partial<Settings>): void {
  if (patch.phaseOverride !== undefined) {
    const ok = patch.phaseOverride === 'auto' || PHASE_IDS.includes(patch.phaseOverride);
    if (!ok) throw new Error(`phaseOverride must be auto or one of ${PHASE_IDS.join(', ')}`);
  }
  if (patch.startDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.startDate)) {
    throw new Error('startDate must be YYYY-MM-DD');
  }
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function getSettings(): Promise<Settings> {
  const db = await openDb();
  const stored = await db.get('settings', SETTINGS_KEY);
  db.close();
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  validate(patch);
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, schemaVersion: DB_VERSION };
  const db = await openDb();
  await db.put('settings', next, SETTINGS_KEY);
  db.close();
  return next;
}
