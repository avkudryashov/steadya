import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '@/lib/frontmatter';

describe('parseFrontmatter', () => {
  it('splits yaml and body', () => {
    const { data, body } = parseFrontmatter('---\nslug: a\nlist: [1, 2]\n---\n\nHello');
    expect(data).toEqual({ slug: 'a', list: [1, 2] });
    expect(body.trim()).toBe('Hello');
  });
  it('throws without frontmatter', () => {
    expect(() => parseFrontmatter('no fm')).toThrow();
  });
});
