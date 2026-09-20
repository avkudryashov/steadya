import { useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import type { Lang } from '@/i18n/locales';

interface Props {
  lang: Lang;
  equipment: Array<{ id: string; label: string }>;
}

export default function AtlasFilter({ lang, equipment }: Props) {
  const [active, setActive] = useState<string | null>(null);

  function choose(id: string | null) {
    setActive(id);
    const grid = document.querySelector<HTMLElement>('[data-atlas]');
    if (!grid) return;
    if (id) grid.dataset.equipment = id;
    else delete grid.dataset.equipment;
  }

  return (
    <div class="atlas-filter" role="group" aria-label={t(lang, 'atlas.filter_label')}>
      <button type="button" aria-pressed={active === null} onClick={() => choose(null)}>
        {t(lang, 'atlas.all')}
      </button>
      {equipment.map((e) => (
        <button
          type="button"
          key={e.id}
          aria-pressed={active === e.id}
          onClick={() => choose(e.id)}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}
