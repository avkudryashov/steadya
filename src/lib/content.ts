import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Lang } from '@/i18n/locales';

export async function getExercisesByLang(lang: Lang): Promise<CollectionEntry<'exercises'>[]> {
  const all = await getCollection('exercises', (e) => e.id.startsWith(`${lang}/`));
  return all.sort((a, b) => a.data.title.localeCompare(b.data.title, lang));
}

export async function getExerciseBySlug(lang: Lang, slug: string) {
  const entry = await getEntry('exercises', `${lang}/${slug}`);
  if (!entry) throw new Error(`exercise ${lang}/${slug} not found`);
  return entry;
}

export async function getProgram() {
  const entry = await getEntry('programs', 'women-70-plus');
  if (!entry) throw new Error('program women-70-plus not found');
  return entry;
}

export async function getPage(lang: Lang, name: string) {
  const entry = await getEntry('pages', `${lang}/${name}`);
  if (!entry) throw new Error(`page ${lang}/${name} not found`);
  return entry;
}

export async function getPagesByLang(lang: Lang) {
  const all = await getCollection('pages', (e) => e.id.startsWith(`${lang}/`));
  return all.sort((a, b) => a.data.order - b.data.order);
}

export function getTests() {
  return getCollection('tests');
}
