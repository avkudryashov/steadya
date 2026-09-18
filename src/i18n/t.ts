import ru from './ru.json';
import type { Lang } from './locales';

export type UiKey = keyof typeof ru;
type Dict = Partial<Record<UiKey, string>>;

const dicts: Record<Lang, Dict> = { ru, en: {}, es: {} };

export function t(lang: Lang, key: UiKey, vars?: Record<string, string | number>): string {
  const template = dicts[lang][key] ?? ru[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}
