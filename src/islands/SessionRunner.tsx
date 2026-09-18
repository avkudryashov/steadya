import { useEffect, useState } from 'preact/hooks';
import type { PhaseId, Prescription, Weekday } from '@/content/schemas';
import { todayIso } from '@/lib/date';
import { resolvePhase, type ProgramMeta } from '@/lib/phase';
import { plannedTopReps, shouldProgress } from '@/lib/progression';
import { getSettings } from '@/lib/storage/settings';
import {
  finishSession,
  getOrCreateSession,
  markSet,
  sessionId,
  topSetsFor,
} from '@/lib/storage/sessions';
import { StorageUnavailableError, type Session } from '@/lib/storage/db';
import RestTimer from '@/islands/RestTimer';
import { t } from '@/i18n/t';
import type { Lang } from '@/i18n/locales';

export interface SessionStep {
  exerciseId: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  cue: string;
  technique: string[];
  stopSigns: string[];
  prescriptions: Record<PhaseId, Prescription>;
}

interface Props {
  lang: Lang;
  weekday: Weekday;
  program: ProgramMeta;
  steps: SessionStep[];
  dayLink: string;
  now?: Date;
}

export default function SessionRunner({ lang, weekday, program, steps, dayLink, now }: Props) {
  const dateIso = todayIso(now ?? new Date());
  const id = sessionId(dateIso, weekday);
  const [session, setSession] = useState<Session | null>(null);
  const [phaseId, setPhaseId] = useState<PhaseId | null>(null);
  const [index, setIndex] = useState(0);
  const [resting, setResting] = useState(false);
  const [sound, setSound] = useState(true);
  const [hint, setHint] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [reps, setReps] = useState('');
  const [load, setLoad] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const settings = await getSettings().catch(() => null);
      const phase = settings
        ? resolvePhase(program, {
            startDate: settings.startDate,
            phaseOverride: settings.phaseOverride,
            dateIso,
          }).phase
        : program.phases[0]!.id;
      if (!alive) return;
      if (settings) setSound(settings.sound);
      try {
        const created = await getOrCreateSession({
          dateIso,
          weekday,
          programId: program.id,
          phaseId: phase,
          plan: steps.map((s) => ({ exerciseId: s.exerciseId, sets: s.prescriptions[phase].sets })),
        });
        if (!alive) return;
        // Set together so the step and its session-derived state render in one pass.
        setPhaseId(phase);
        setSession(created);
      } catch (err) {
        if (!alive) return;
        setPhaseId(phase);
        if (err instanceof StorageUnavailableError) setStorageUnavailable(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let released: { release: () => Promise<void> } | null = null;
    void (async () => {
      try {
        released = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        /* без Wake Lock экран может гаснуть */
      }
    })();
    return () => {
      void released?.release().catch(() => undefined);
    };
  }, []);

  // Switching steps (or unmounting) must not leave a rest timer running, or a
  // previous exercise's typed reps/load, behind.
  useEffect(() => {
    setResting(false);
    setReps('');
    setLoad('');
  }, [index]);

  const step = steps[index];
  const prescription = step && phaseId ? step.prescriptions[phaseId] : undefined;
  const item = session?.items.find((i) => i.exerciseId === step?.exerciseId);
  const nextSetIndex = item?.sets.findIndex((s) => !s.done) ?? -1;

  useEffect(() => {
    if (!step || !prescription) return;
    let alive = true;
    void topSetsFor(step.exerciseId, 2)
      .then((last) => {
        if (alive) setHint(shouldProgress(plannedTopReps(prescription.reps), last));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [index, session?.id, phaseId]);

  if (!step || !prescription) return null;

  async function doSet() {
    if (!session || nextSetIndex < 0 || !prescription) return;
    const patch: { done: true; reps?: number; load?: string } = { done: true };
    const parsed = Number(reps);
    if (reps.trim() !== '' && Number.isFinite(parsed)) patch.reps = parsed;
    if (load.trim() !== '') patch.load = load.trim();
    const updated = await markSet(session.id, step.exerciseId, nextSetIndex, patch);
    setSession({ ...updated });
    setReps('');
    setLoad('');
    if (prescription.restSec > 0) setResting(true);
  }

  async function finish() {
    if (!session) return;
    const done = await finishSession(session.id);
    setSession({ ...done });
  }

  const volume =
    prescription.seconds !== undefined
      ? t(lang, 'exercise.sets_seconds', { sets: prescription.sets, seconds: prescription.seconds })
      : t(lang, 'exercise.sets_reps', { sets: prescription.sets, reps: prescription.reps ?? '' });

  return (
    <div class="runner">
      <p class="runner-progress">
        {t(lang, 'session.step', { index: index + 1, total: steps.length })}
      </p>
      <h1>{step.title}</h1>
      <img src={step.imageSrc} alt={step.imageAlt} width="640" height="640" />
      <p class="runner-cue">{step.cue}</p>
      <p class="runner-prescription">
        {volume}
        {prescription.load ? `, ${prescription.load}` : ''}
        {prescription.note ? `, ${prescription.note}` : ''}
      </p>

      <div class="runner-technique">
        <h2>{t(lang, 'exercise.technique')}</h2>
        <ol>
          {step.technique.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>

      {!session?.finishedAt && nextSetIndex >= 0 && (
        <p class="runner-set">
          {t(lang, 'session.set_of', { index: nextSetIndex + 1, total: prescription.sets })}
        </p>
      )}

      <div role="status">
        {hint && <p class="note warn">{t(lang, 'session.progress_hint')}</p>}
        {session?.finishedAt && <p class="note">{t(lang, 'session.finished')}</p>}
        {storageUnavailable && <p class="note warn">{t(lang, 'storage.unavailable')}</p>}
      </div>

      {resting ? (
        <RestTimer
          key={`${step.exerciseId}-${nextSetIndex}`}
          lang={lang}
          seconds={prescription.restSec}
          sound={sound}
          onDone={() => setResting(false)}
        />
      ) : (
        !storageUnavailable && (
          <div class="runner-inputs">
            <label>
              {t(lang, 'session.reps')}
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={reps}
                onInput={(e) => setReps((e.target as HTMLInputElement).value)}
              />
            </label>
            <label>
              {t(lang, 'session.load')}
              <input
                type="text"
                value={load}
                onInput={(e) => setLoad((e.target as HTMLInputElement).value)}
              />
            </label>
          </div>
        )
      )}

      <div class="runner-actions">
        {nextSetIndex >= 0 && !resting && !session?.finishedAt && (
          <button type="button" class="btn" onClick={() => void doSet()}>
            {t(lang, 'session.set_done')}
          </button>
        )}
        {index > 0 && (
          <button type="button" class="btn secondary" onClick={() => setIndex(index - 1)}>
            {t(lang, 'session.prev')}
          </button>
        )}
        {index < steps.length - 1 ? (
          <button type="button" class="btn secondary" onClick={() => setIndex(index + 1)}>
            {t(lang, 'session.next')}
          </button>
        ) : (
          session &&
          !session.finishedAt && (
            <button type="button" class="btn secondary" onClick={() => void finish()}>
              {t(lang, 'session.finish')}
            </button>
          )
        )}
        <a class="btn secondary" href={dayLink}>
          {t(lang, 'session.exit')}
        </a>
      </div>

      <details class="runner-stop">
        <summary>{t(lang, 'session.stop_signs')}</summary>
        <ul>
          {step.stopSigns.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
