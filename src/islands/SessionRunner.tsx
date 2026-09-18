import { useEffect, useState } from 'preact/hooks';
import type { PhaseId, Prescription, Weekday } from '@/content/schemas';
import { todayIso } from '@/lib/date';
import { resolvePhase, type ProgramMeta } from '@/lib/phase';
import { formatPrescription } from '@/lib/program';
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

export type SessionStep =
  | {
      kind: 'exercise';
      exerciseId: string;
      title: string;
      imageSrc: string;
      imageAlt: string;
      cue: string;
      technique: string[];
      stopSigns: string[];
      prescriptions: Record<PhaseId, Prescription>;
    }
  | { kind: 'routine'; title: string; items: Array<{ text: string; minutes?: number }> }
  | { kind: 'text'; title: string; text: string; byPhase?: Partial<Record<PhaseId, string>> };

interface Props {
  lang: Lang;
  weekday: Weekday;
  program: ProgramMeta;
  steps: SessionStep[];
  dayLink: string;
  now?: Date;
}

/** On a deload week every exercise plans one set fewer, never below one. */
function plannedSets(prescription: Prescription, deload: boolean): number {
  return deload ? Math.max(1, prescription.sets - 1) : prescription.sets;
}

/** Same composition as the day sheet's prescription table: step, load, note. */
function prescriptionDetails(lang: Lang, p: Prescription): string {
  return [t(lang, `exercise.step.${p.step}`), p.load, p.note].filter(Boolean).join(', ');
}

export default function SessionRunner({ lang, weekday, program, steps, dayLink, now }: Props) {
  const dateIso = todayIso(now ?? new Date());
  const id = sessionId(dateIso, weekday);
  const [session, setSession] = useState<Session | null>(null);
  const [phaseId, setPhaseId] = useState<PhaseId | null>(null);
  const [deload, setDeload] = useState(false);
  const [index, setIndex] = useState(0);
  const [resting, setResting] = useState(false);
  const [restOver, setRestOver] = useState(false);
  const [sound, setSound] = useState(true);
  const [hint, setHint] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [reps, setReps] = useState('');
  const [load, setLoad] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const settings = await getSettings().catch(() => null);
      const resolved = settings
        ? resolvePhase(program, {
            startDate: settings.startDate,
            phaseOverride: settings.phaseOverride,
            dateIso,
          })
        : null;
      const phase = resolved ? resolved.phase : program.phases[0]!.id;
      const isDeload = resolved ? resolved.deload : false;
      if (!alive) return;
      if (settings) setSound(settings.sound);
      const exerciseSteps = steps.filter((s) => s.kind === 'exercise');
      try {
        const created = await getOrCreateSession({
          dateIso,
          weekday,
          programId: program.id,
          phaseId: phase,
          plan: exerciseSteps.map((s) => ({
            exerciseId: s.exerciseId,
            sets: plannedSets(s.prescriptions[phase], isDeload),
          })),
        });
        if (!alive) return;
        // Set together so the step and its session-derived state render in one pass.
        setPhaseId(phase);
        setDeload(isDeload);
        setSession(created);
      } catch (err) {
        if (!alive) return;
        setPhaseId(phase);
        setDeload(isDeload);
        if (err instanceof StorageUnavailableError) setStorageUnavailable(true);
        else setSaveFailed(true);
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

  // Switching steps (or unmounting) must not leave a rest timer, a stale
  // "rest over" notice, or a previous exercise's typed reps/load, behind.
  useEffect(() => {
    setResting(false);
    setRestOver(false);
    setReps('');
    setLoad('');
  }, [index]);

  const step = steps[index] as SessionStep | undefined;
  const prescription =
    step && step.kind === 'exercise' && phaseId ? step.prescriptions[phaseId] : undefined;
  const item =
    step && step.kind === 'exercise'
      ? session?.items.find((i) => i.exerciseId === step.exerciseId)
      : undefined;
  const nextSetIndex = item?.sets.findIndex((s) => !s.done) ?? -1;
  const hasProgress = session?.items.some((i) => i.sets.some((s) => s.done)) ?? false;

  useEffect(() => {
    if (!step || step.kind !== 'exercise' || !prescription) {
      setHint(false);
      return;
    }
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

  if (!step) return null;
  // Exercise steps need phaseId (and, alongside it, the session) to render a
  // consistent prescription/set count in one pass; routine and text steps do
  // not depend on either and can show immediately.
  if (step.kind === 'exercise' && !phaseId) return null;

  async function doSet() {
    if (!step || step.kind !== 'exercise' || !session || nextSetIndex < 0 || !prescription) return;
    const patch: { done: true; reps?: number; load?: string } = { done: true };
    const parsed = Number(reps);
    if (reps.trim() !== '' && Number.isFinite(parsed)) patch.reps = parsed;
    if (load.trim() !== '') patch.load = load.trim();
    try {
      const updated = await markSet(session.id, step.exerciseId, nextSetIndex, patch);
      setSession({ ...updated });
      setReps('');
      setLoad('');
      if (prescription.restSec > 0) {
        setRestOver(false);
        setResting(true);
      }
    } catch (err) {
      if (err instanceof StorageUnavailableError) setStorageUnavailable(true);
      else setSaveFailed(true);
    }
  }

  async function finish() {
    if (!session) return;
    try {
      const done = await finishSession(session.id);
      setSession({ ...done });
    } catch (err) {
      if (err instanceof StorageUnavailableError) setStorageUnavailable(true);
      else setSaveFailed(true);
    }
  }

  return (
    <div class="runner">
      <p class="runner-progress">
        {t(lang, 'session.step', { index: index + 1, total: steps.length })}
      </p>
      <h1>{step.title}</h1>

      {step.kind === 'exercise' && (
        <>
          <img src={step.imageSrc} alt={step.imageAlt} width="640" height="640" />
          <p class="runner-cue">{step.cue}</p>
          {prescription && (
            <>
              <p class="runner-prescription">{formatPrescription(prescription, lang)}</p>
              {prescriptionDetails(lang, prescription) && (
                <p class="runner-details">{prescriptionDetails(lang, prescription)}</p>
              )}
            </>
          )}

          <div class="runner-technique">
            <h2>{t(lang, 'exercise.technique')}</h2>
            <ol>
              {step.technique.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>

          {!session?.finishedAt && nextSetIndex >= 0 && item && (
            <p class="runner-set">
              {t(lang, 'session.set_of', { index: nextSetIndex + 1, total: item.sets.length })}
            </p>
          )}
        </>
      )}

      {step.kind === 'routine' && (
        <ol class="runner-routine">
          {step.items.map((line) => (
            <li key={line.text}>
              {line.text}
              {line.minutes ? ` · ${t(lang, 'day.duration', { min: line.minutes })}` : ''}
            </li>
          ))}
        </ol>
      )}

      {step.kind === 'text' && (
        <>
          <p class="runner-text">{step.text}</p>
          {phaseId && step.byPhase?.[phaseId] && <p class="note">{step.byPhase[phaseId]}</p>}
        </>
      )}

      <div role="status">
        {deload && <p class="note">{t(lang, 'today.deload')}</p>}
        {step.kind === 'exercise' && hint && (
          <p class="note warn">{t(lang, 'session.progress_hint')}</p>
        )}
        {session?.finishedAt && <p class="note">{t(lang, 'session.finished')}</p>}
        {storageUnavailable && <p class="note warn">{t(lang, 'storage.unavailable')}</p>}
        {saveFailed && <p class="note warn">{t(lang, 'session.save_failed')}</p>}
        {restOver && <p class="note">{t(lang, 'session.rest_over')}</p>}
      </div>

      {step.kind === 'exercise' && resting && prescription ? (
        <RestTimer
          key={`${step.exerciseId}-${nextSetIndex}`}
          lang={lang}
          seconds={prescription.restSec}
          sound={sound}
          onDone={() => {
            setResting(false);
            setRestOver(true);
          }}
        />
      ) : (
        step.kind === 'exercise' &&
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
        {step.kind === 'exercise' && nextSetIndex >= 0 && !resting && !session?.finishedAt && (
          <button type="button" class="btn" onClick={() => void doSet()}>
            {t(lang, 'session.set_done')}
          </button>
        )}
        {index > 0 && (
          <button type="button" class="btn secondary" onClick={() => setIndex(index - 1)}>
            {t(lang, 'session.prev')}
          </button>
        )}
        {index < steps.length - 1 && (
          <button type="button" class="btn secondary" onClick={() => setIndex(index + 1)}>
            {t(lang, 'session.next')}
          </button>
        )}
        {session && hasProgress && !session.finishedAt && (
          <button type="button" class="btn secondary" onClick={() => void finish()}>
            {t(lang, 'session.finish')}
          </button>
        )}
        <a class="btn secondary" href={dayLink}>
          {t(lang, 'session.exit')}
        </a>
      </div>

      {step.kind === 'exercise' && (
        <details class="runner-stop">
          <summary>{t(lang, 'session.stop_signs')}</summary>
          <ul>
            {step.stopSigns.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
