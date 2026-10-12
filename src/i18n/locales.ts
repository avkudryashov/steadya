export const LOCALES = ['ru', 'en', 'es', 'fr', 'it', 'de', 'pl', 'pt', 'uk'] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Lang = 'ru';

// Название языка на нём самом: человек ищет в переключателе свой язык,
// а не его перевод на текущий.
export const LOCALE_NAMES: Record<Lang, string> = {
  ru: 'Русский',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  pl: 'Polski',
  pt: 'Português',
  uk: 'Українська',
};

export function isLang(x: string): x is Lang {
  return (LOCALES as readonly string[]).includes(x);
}

export function parseBuiltLocales(raw: string | undefined): Lang[] {
  const extra = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(isLang)
    .filter((l) => l !== DEFAULT_LOCALE);
  return [DEFAULT_LOCALE, ...Array.from(new Set(extra))];
}

export const BUILT_LOCALES: Lang[] = parseBuiltLocales(import.meta.env.PUBLIC_LOCALES);
