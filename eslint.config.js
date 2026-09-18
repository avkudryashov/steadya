import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', '.astro/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  ...astro.configs['jsx-a11y-strict'],
  {
    files: ['**/*.astro'],
    rules: {
      // A named scrollable region is the documented way to make an overflowing
      // table reachable from the keyboard (WCAG 2.1 SC 2.1.1).
      'astro/jsx-a11y/no-noninteractive-tabindex': [
        'error',
        { tags: [], roles: ['tabpanel', 'region'], allowExpressionValues: true },
      ],
    },
  },
  prettier,
);
