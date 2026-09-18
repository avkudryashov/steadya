import type { Lang } from '@/i18n/locales';

export function buildLocaleUrl(base: string, lang: Lang, path: string): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  const p = path.replace(/^\/+/, '').replace(/\/+$/, '');
  return p ? `${b}${lang}/${p}/` : `${b}${lang}/`;
}

export function localeUrl(lang: Lang, path = ''): string {
  return buildLocaleUrl(import.meta.env.BASE_URL, lang, path);
}
