import ru from './ru.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import it from './it.json';
import de from './de.json';
import pl from './pl.json';
import pt from './pt.json';
import uk from './uk.json';
import type { Lang } from './locales';

export type UiKey = keyof typeof ru;
type Dict = Partial<Record<UiKey, string>>;

const dicts: Record<Lang, Dict> = { ru, en, es, fr, it, de, pl, pt, uk };

export function t(lang: Lang, key: UiKey, vars?: Record<string, string | number>): string {
  const template = dicts[lang][key] ?? ru[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}
