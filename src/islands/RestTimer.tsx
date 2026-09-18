import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import type { Lang } from '@/i18n/locales';

interface Props {
  lang: Lang;
  seconds: number;
  sound: boolean;
  onDone: () => void;
}

function beep(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, 350);
  } catch {
    /* звук не обязателен */
  }
}

export default function RestTimer({ lang, seconds, sound, onDone }: Props) {
  const [left, setLeft] = useState(seconds);
  const endAt = useRef(Date.now() + seconds * 1000);

  useEffect(() => {
    endAt.current = Date.now() + seconds * 1000;
    setLeft(seconds);
    const id = window.setInterval(() => {
      const remaining = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(id);
        if (sound) beep();
        try {
          navigator.vibrate?.(200);
        } catch {
          /* вибрация не обязательна */
        }
        onDone();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [seconds]);

  return (
    <div class="rest" role="timer" aria-live="polite">
      <p class="rest-label">{t(lang, 'session.rest')}</p>
      <p class="rest-value">{left}</p>
      <button type="button" class="btn secondary" onClick={onDone}>
        {t(lang, 'session.rest_skip')}
      </button>
    </div>
  );
}
