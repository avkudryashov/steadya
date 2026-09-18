import { parse } from 'yaml';

export function parseFrontmatter(text: string): { data: unknown; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error('no frontmatter block');
  return { data: parse(match[1]!), body: match[2] ?? '' };
}
