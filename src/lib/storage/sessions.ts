import type { PhaseId, Weekday } from '@/content/schemas';
import { openDb, type Session, type SetRecord } from '@/lib/storage/db';

/** Builds the session id from the date and the weekday. */
export function sessionId(dateIso: string, weekday: Weekday): string {
  return `${dateIso}:${weekday}`;
}

export interface SessionPlan {
  dateIso: string;
  weekday: Weekday;
  programId: string;
  phaseId: PhaseId;
  plan: Array<{ exerciseId: string; sets: number }>;
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function getSession(id: string): Promise<Session | undefined> {
  const db = await openDb();
  const s = await db.get('sessions', id);
  db.close();
  return s;
}

/**
 * Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB.
 *
 * Each exercise card mounts its own logger and only knows its own plan, so a
 * later card's first tap must add its item to a session another card already
 * created for the same day, rather than ignore it.
 */
export async function getOrCreateSession(input: SessionPlan): Promise<Session> {
  const id = sessionId(input.dateIso, input.weekday);
  const existing = await getSession(id);
  if (existing) {
    const missing = input.plan.filter(
      (p) => !existing.items.some((i) => i.exerciseId === p.exerciseId),
    );
    if (missing.length === 0) return existing;
    return update(id, (session) => {
      for (const p of missing) {
        if (session.items.some((i) => i.exerciseId === p.exerciseId)) continue;
        session.items.push({
          exerciseId: p.exerciseId,
          sets: Array.from({ length: p.sets }, () => ({ done: false })),
        });
      }
    });
  }
  const session: Session = {
    id,
    date: input.dateIso,
    weekday: input.weekday,
    programId: input.programId,
    phaseId: input.phaseId,
    startedAt: new Date().toISOString(),
    items: input.plan.map((p) => ({
      exerciseId: p.exerciseId,
      sets: Array.from({ length: p.sets }, () => ({ done: false })),
    })),
  };
  const db = await openDb();
  await db.put('sessions', session);
  db.close();
  return session;
}

async function update(id: string, mutate: (s: Session) => void): Promise<Session> {
  const db = await openDb();
  try {
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    const session = await store.get(id);
    if (!session) {
      void tx.done.catch(() => undefined);
      throw new Error(`session ${id} not found`);
    }
    mutate(session);
    await store.put(session);
    await tx.done;
    return session;
  } finally {
    db.close();
  }
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export function markSet(
  id: string,
  exerciseId: string,
  index: number,
  patch: Partial<SetRecord>,
): Promise<Session> {
  return update(id, (session) => {
    const item = session.items.find((i) => i.exerciseId === exerciseId);
    if (!item) throw new Error(`session ${id} has no exercise ${exerciseId}`);
    const set = item.sets[index];
    if (!set) throw new Error(`exercise ${exerciseId} has no set ${index}`);
    Object.assign(set, patch);
  });
}

/**
 * Applies reps and/or load to every set of the exercise in one transaction.
 * Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB.
 */
export function setExerciseFields(
  id: string,
  exerciseId: string,
  patch: { reps?: number; load?: string },
): Promise<Session> {
  return update(id, (session) => {
    const item = session.items.find((i) => i.exerciseId === exerciseId);
    if (!item) throw new Error(`session ${id} has no exercise ${exerciseId}`);
    for (const set of item.sets) {
      if (patch.reps !== undefined) set.reps = patch.reps;
      if (patch.load !== undefined) set.load = patch.load;
    }
  });
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export function finishSession(id: string): Promise<Session> {
  return update(id, (session) => {
    session.finishedAt = new Date().toISOString();
  });
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function listSessions(limit?: number): Promise<Session[]> {
  const db = await openDb();
  const all = await db.getAll('sessions');
  db.close();
  all.sort((a, b) => b.date.localeCompare(a.date));
  return limit === undefined ? all : all.slice(0, limit);
}

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function topSetsFor(exerciseId: string, limit: number): Promise<number[]> {
  const sessions = await listSessions();
  const out: number[] = [];
  for (const session of sessions) {
    const item = session.items.find((i) => i.exerciseId === exerciseId);
    if (!item) continue;
    const done = item.sets.filter((s) => s.done && typeof s.reps === 'number');
    const last = done[done.length - 1];
    if (last?.reps !== undefined) out.push(last.reps);
    if (out.length === limit) break;
  }
  return out;
}
