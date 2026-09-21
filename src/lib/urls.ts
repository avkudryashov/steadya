import type { Lang } from '@/i18n/locales';

export function buildLocaleUrl(base: string, lang: Lang, path: string): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  const p = path.replace(/^\/+/, '').replace(/\/+$/, '');
  return p ? `${b}${lang}/${p}/` : `${b}${lang}/`;
}

export function localeUrl(lang: Lang, path = ''): string {
  return buildLocaleUrl(import.meta.env.BASE_URL, lang, path);
}

export function buildPdfUrl(base: string, lang: Lang, name: string): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${b}${lang}/pdf/${name}.pdf`;
}

export function pdfUrl(lang: Lang, name: string): string {
  return buildPdfUrl(import.meta.env.BASE_URL, lang, name);
}
