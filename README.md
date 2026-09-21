# Steadya

Домашняя программа тренировок для женщин 70+: устойчивость, сила, осанка.
Сайт-тренажёр на Astro. Спека и планы: `~/docs/superpowers/specs/2026-09-18-steadya-site-design.md`.

## Команды

- `pnpm dev` локальный сервер
- `pnpm build` сборка в `dist/`, затем печатает готовые PDF в `dist/ru/pdf/`
  (нужен playwright с chromium, установленный в системе)
- `pnpm build:nopdf` та же сборка, но без PDF (быстрый прогон, `SKIP_PDF=1`)
- `pnpm check && pnpm lint && pnpm test && pnpm validate` проверки

## Переменные сборки

- `SITE_URL` (по умолчанию `https://steadya.app`)
- `BASE_PATH` (по умолчанию `/`)
- `PUBLIC_LOCALES` (по умолчанию `ru`)
