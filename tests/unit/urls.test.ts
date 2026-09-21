import { describe, expect, it } from 'vitest';
import { buildLocaleUrl, buildPdfUrl } from '@/lib/urls';

describe('buildLocaleUrl', () => {
  it('prefixes base and lang and ends with slash', () => {
    expect(buildLocaleUrl('/', 'ru', 'day/monday')).toBe('/ru/day/monday/');
    expect(buildLocaleUrl('/steadya/', 'ru', '/day/monday/')).toBe('/steadya/ru/day/monday/');
  });
  it('handles root path', () => {
    expect(buildLocaleUrl('/', 'ru', '')).toBe('/ru/');
    expect(buildLocaleUrl('/steadya', 'en', '/')).toBe('/steadya/en/');
  });
});

describe('buildPdfUrl', () => {
  it('prefixes base and lang and appends .pdf', () => {
    expect(buildPdfUrl('/', 'ru', 'day-monday')).toBe('/ru/pdf/day-monday.pdf');
    expect(buildPdfUrl('/steadya', 'ru', 'program')).toBe('/steadya/ru/pdf/program.pdf');
  });
});
