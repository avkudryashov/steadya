import { useEffect, useRef, useState } from 'preact/hooks';
import type { PhaseId, Prescription, Weekday } from '@/content/schemas';
import { todayIso } from '@/lib/date';
import { resolvePhase, type ProgramMeta } from '@/lib/phase';
import { plannedTopReps, shouldProgress } from '@/lib/progression';
import { getSettings } from '@/lib/storage/settings';
import {
  getOrCreateSession,
  getSession,
  markSet,
  sessionId,
  setExerciseFields,
  topSetsFor,
} from '@/lib/storage/sessions';
import { StorageUnavailableError, type Session } from '@/lib/storage/db';
import RestTimer from '@/islands/RestTimer';
import { t } from '@/i18n/t';
import type { Lang } from '@/i18n/locales';

interface Props {
  lang: Lang;
  weekday: Weekday;
  program: ProgramMeta;
  exerciseId: string;
  prescriptions: Record<PhaseId, Prescription>;
  now?: Date;
}

type Note = { kind: 'set_done'; index: number } | { kind: 'rest_over' } | { kind: 'saved' } | null;

const SAVE_DEBOUNCE_MS = 600;

/** On a deload week every exercise plans one set fewer, never below one. */
function plannedSets(prescription: Prescription, deload: boolean): number {
  return deload ? Math.max(1, prescription.sets - 1) : prescription.sets;
}

export default function SetLogger({
  lang,
  weekday,
  program,
  exerciseId,
  prescriptions,
  now,
}: Props) {
  const dateIso = todayIso(now ?? new Date());
  const id = sessionId(dateIso, weekday);
  const [session, setSession] = useState<Session | null>(null);
  const [phaseId, setPhaseId] = useState<PhaseId | null>(null);
  const [deload, setDeload] = useState(false);
  const [sound, setSound] = useState(true);
  const [resting, setResting] = useState(false);
  const [restingIndex, setRestingIndex] = useState(0);
  const [hint, setHint] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [reps, setReps] = useState('');
  const [load, setLoad] = useState('');
  const debounceRef = useRef<number | undefined>(undefined);

  // Reads (never creates) any session already on record for today, so that
  // opening the day sheet alone leaves no trace; a session only comes into
  // being on the first tap, in ensureSession below.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const settings = await getSettings();
        const resolved = resolvePhase(program, {
          startDate: settings.startDate,
          phaseOverride: settings.phaseOverride,
          dateIso,
        });
        if (!alive) return;
        setPhaseId(resolved.phase);
        setDeload(resolved.deload);
        setSound(settings.sound);
        const existing = await getSession(id);
        if (!alive) return;
        if (existing) setSession(existing);
      } catch (err) {
        if (!alive) return;
        if (err instanceof StorageUnavailableError) setStorageUnavailable(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    },
    [],
  );

  const prescription = phaseId ? prescriptions[phaseId] : undefined;
  const sets = prescription ? plannedSets(prescription, deload) : 0;
  const item = session?.items.find((i) => i.exerciseId === exerciseId);
  const doneFlags = Array.from({ length: sets }, (_, i) => item?.sets[i]?.done ?? false);

  useEffect(() => {
    if (!prescription) {
      setHint(false);
      return;
    }
    let alive = true;
    void topSetsFor(exerciseId, 2)
      .then((last) => {
        if (alive) setHint(shouldProgress(plannedTopReps(prescription.reps), last));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [exerciseId, phaseId, session]);

  async function ensureSession(): Promise<Session> {
    if (session) return session;
    if (!phaseId || !prescription) throw new Error('phase not resolved yet');
    const created = await getOrCreateSession({
      dateIso,
      weekday,
      programId: program.id,
      phaseId,
      plan: [{ exerciseId, sets }],
    });
    setSession(created);
    return created;
  }

  async function toggleSet(index: number) {
    const done = doneFlags[index] ?? false;
    try {
      const current = done ? (session as Session) : await ensureSession();
      const updated = await markSet(current.id, exerciseId, index, { done: !done });
      setSession({ ...updated });
      if (done) {
        setResting(false);
        setNote(null);
        return;
      }
      setNote({ kind: 'set_done', index: index + 1 });
      if (prescription && prescription.restSec > 0) {
        setRestingIndex(index);
        setResting(true);
      }
    } catch (err) {
      if (err instanceof StorageUnavailableError) setStorageUnavailable(true);
      else setSaveFailed(true);
    }
  }

  async function save(repsVal: string, loadVal: string) {
    const patch: { reps?: number; load?: string } = {};
    const parsed = Number(repsVal);
    if (repsVal.trim() !== '' && Number.isFinite(parsed)) patch.reps = parsed;
    if (loadVal.trim() !== '') patch.load = loadVal.trim();
    if (patch.reps === undefined && patch.load === undefined) return;
    try {
      const current = await ensureSession();
      const updated = await setExerciseFields(current.id, exerciseId, patch);
      setSession({ ...updated });
      setNote({ kind: 'saved' });
    } catch (err) {
      if (err instanceof StorageUnavailableError) setStorageUnavailable(true);
      else setSaveFailed(true);
    }
  }

  function scheduleSave(nextReps: string, nextLoad: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void save(nextReps, nextLoad);
    }, SAVE_DEBOUNCE_MS);
  }

  if (storageUnavailable) {
    return (
      <div class="logger">
        <div role="status">
          <p class="note warn">{t(lang, 'storage.unavailable')}</p>
        </div>
      </div>
    );
  }

  if (!prescription) return null;

  const humanDate = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' }).format(
    now ?? new Date(),
  );

  return (
    <div class="logger">
      <h4>{t(lang, 'log.heading')}</h4>
      <p class="logger-today">{t(lang, 'log.today', { date: humanDate })}</p>
      <div class="logger-sets">
        {doneFlags.map((done, i) => (
          <button
            type="button"
            key={i}
            class="logger-set"
            aria-pressed={done}
            onClick={() => void toggleSet(i)}
          >
            {t(lang, 'log.set', { index: i + 1 })}
          </button>
        ))}
      </div>
      <div role="status">
        {saveFailed && <p class="note warn">{t(lang, 'session.save_failed')}</p>}
        {hint && <p class="note warn">{t(lang, 'session.progress_hint')}</p>}
        {note?.kind === 'set_done' && (
          <p class="note">{t(lang, 'log.set_done', { index: note.index })}</p>
        )}
        {note?.kind === 'rest_over' && <p class="note">{t(lang, 'session.rest_over')}</p>}
        {note?.kind === 'saved' && <p class="note">{t(lang, 'log.saved')}</p>}
      </div>
      {resting ? (
        <RestTimer
          key={`${exerciseId}-${restingIndex}`}
          lang={lang}
          seconds={prescription.restSec}
          sound={sound}
          onDone={() => {
            setResting(false);
            setNote({ kind: 'rest_over' });
          }}
        />
      ) : (
        <div class="logger-inputs">
          <label>
            {t(lang, 'log.load')}
            <input
              type="text"
              value={load}
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                setLoad(v);
                scheduleSave(reps, v);
              }}
            />
          </label>
          <label>
            {t(lang, 'log.reps')}
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={reps}
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                setReps(v);
                scheduleSave(v, load);
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
