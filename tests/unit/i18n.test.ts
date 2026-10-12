import { describe, expect, it } from 'vitest';
import { t } from '@/i18n/t';
import { BUILT_LOCALES, DEFAULT_LOCALE, isLang, parseBuiltLocales } from '@/i18n/locales';

describe('locales', () => {
  it('default locale is ru and is always built', () => {
    expect(DEFAULT_LOCALE).toBe('ru');
    expect(BUILT_LOCALES).toContain('ru');
  });
  it('parseBuiltLocales keeps only known locales and always includes ru', () => {
    expect(parseBuiltLocales('en,es')).toEqual(['ru', 'en', 'es']);
    expect(parseBuiltLocales('xx, en')).toEqual(['ru', 'en']);
    expect(parseBuiltLocales(undefined)).toEqual(['ru']);
  });
  it('isLang', () => {
    expect(isLang('ru')).toBe(true);
    expect(isLang('de')).toBe(true);
    expect(isLang('xx')).toBe(false);
  });
});

describe('t', () => {
  it('returns russian string', () => {
    expect(t('ru', 'nav.today')).toBe('Сегодня');
  });
  it('every locale has its own string', () => {
    expect(t('en', 'nav.today')).not.toBe('Сегодня');
  });
  it('interpolates variables', () => {
    expect(t('ru', 'day.duration', { min: 45 })).toBe('45 мин');
  });
});
