import { useEffect, useState } from 'preact/hooks';
import type { Weekday } from '@/content/schemas';
import { todayIso, weekdayOf } from '@/lib/date';
import { resolvePhase, type PhaseState, type ProgramMeta } from '@/lib/phase';
import { getSettings } from '@/lib/storage/settings';
import { StorageUnavailableError } from '@/lib/storage/db';
import { t } from '@/i18n/t';
import type { Lang } from '@/i18n/locales';

export interface DayMeta {
  weekday: Weekday;
  title: string;
  durationMin: number;
  kind: string;
}

interface Props {
  lang: Lang;
  program: ProgramMeta;
  days: DayMeta[];
  dayLinks: Record<Weekday, string>;
  settingsLink?: string;
  now?: Date;
}

export default function TodayCard({
  lang,
  program,
  days,
  dayLinks,
  settingsLink = '',
  now,
}: Props) {
  const [state, setState] = useState<PhaseState | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const dateIso = todayIso(now ?? new Date());
  const weekday = weekdayOf(dateIso);
  const day = days.find((d) => d.weekday === weekday);

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((settings) => {
        if (!alive) return;
        setState(
          resolvePhase(program, {
            startDate: settings.startDate,
            phaseOverride: settings.phaseOverride,
            dateIso,
          }),
        );
      })
      .catch((err) => {
        if (!alive) return;
        setState(null);
        if (err instanceof StorageUnavailableError) {
          setStorageUnavailable(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [dateIso]);

  if (!day) return null;
  const phaseLabel = state ? program.phases.find((p) => p.id === state.phase)?.label : undefined;
  const isRest = day.durationMin === 0 || day.kind === 'rest';

  return (
    <section class="today card" aria-labelledby="today-heading">
      <h2 id="today-heading">{t(lang, 'today.heading')}</h2>
      <p class="today-day">{isRest ? t(lang, 'today.rest') : day.title}</p>
      <div role="status">
        {storageUnavailable && <p class="note warn">{t(lang, 'storage.unavailable')}</p>}
        {state?.deload && <p class="note">{t(lang, 'today.deload')}</p>}
        {state?.beyondProgram && (
          <p class="note warn">
            {t(lang, 'today.beyond')}{' '}
            {settingsLink && <a href={settingsLink}>{t(lang, 'today.settings')}</a>}
          </p>
        )}
      </div>
      {state && (
        <p class="today-meta">
          {t(lang, 'today.week', { week: state.week, total: program.weeks })}
          {phaseLabel ? ` · ${t(lang, 'today.phase', { label: phaseLabel })}` : ''}
        </p>
      )}
      <p class="today-actions">
        <a class="btn" href={dayLinks[weekday]}>
          {t(lang, 'today.open')}
        </a>
      </p>
    </section>
  );
}
