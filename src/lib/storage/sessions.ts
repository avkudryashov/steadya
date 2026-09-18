import type { PhaseId, Weekday } from '@/content/schemas';
import { openDb, type Session, type SetRecord } from '@/lib/storage/db';

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

/** Rejects with {@link StorageUnavailableError} when the browser has no usable IndexedDB. */
export async function getOrCreateSession(input: SessionPlan): Promise<Session> {
  const id = sessionId(input.dateIso, input.weekday);
  const existing = await getSession(id);
  if (existing) return existing;
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
  const session = await db.get('sessions', id);
  if (!session) {
    db.close();
    throw new Error(`session ${id} not found`);
  }
  mutate(session);
  await db.put('sessions', session);
  db.close();
  return session;
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
