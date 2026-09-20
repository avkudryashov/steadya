import { useEffect, useState } from 'preact/hooks';
import type { PhaseId } from '@/content/schemas';
import { getSettings, saveSettings } from '@/lib/storage/settings';
import { StorageUnavailableError } from '@/lib/storage/db';
import { t } from '@/i18n/t';
import type { Lang } from '@/i18n/locales';

interface Props {
  lang: Lang;
  phases: Array<{ id: PhaseId; label: string }>;
}

function apply(phase: PhaseId | null): void {
  const root = document.documentElement;
  if (phase) root.dataset.phase = phase;
  else delete root.dataset.phase;
}

export default function PhaseFilter({ lang, phases }: Props) {
  const [active, setActive] = useState<PhaseId | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => {
        if (!alive) return;
        const phase = s.phaseOverride === 'auto' ? null : s.phaseOverride;
        setActive(phase);
        apply(phase);
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof StorageUnavailableError) setStorageUnavailable(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  function choose(phase: PhaseId | null) {
    setActive(phase);
    apply(phase);
    void saveSettings({ phaseOverride: phase ?? 'auto' }).catch((err) => {
      if (err instanceof StorageUnavailableError) setStorageUnavailable(true);
    });
  }

  return (
    <div class="phase-filter" role="group" aria-label={t(lang, 'phase.filter_label')}>
      {phases.map((p) => (
        <button
          type="button"
          key={p.id}
          aria-pressed={active === p.id}
          onClick={() => choose(p.id)}
        >
          {p.label}
        </button>
      ))}
      <button type="button" aria-pressed={active === null} onClick={() => choose(null)}>
        {t(lang, 'phase.all')}
      </button>
      <div role="status">
        {storageUnavailable && <p class="note warn">{t(lang, 'storage.unavailable')}</p>}
      </div>
    </div>
  );
}
