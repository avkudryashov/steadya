# Steadya

Домашняя программа тренировок для женщин 70+: устойчивость, сила, осанка.
Сайт-тренажёр на Astro. Спека и планы: `~/docs/superpowers/specs/2026-09-18-steadya-site-design.md`.

## Команды

- `pnpm dev` локальный сервер
- `pnpm build` сборка в `dist/`, затем печатает готовые PDF в `dist/ru/pdf/`
  (нужен playwright с chromium, установленный в системе)
- `pnpm build:nopdf` та же сборка, но без PDF (быстрый прогон, `SKIP_PDF=1`)
- `pnpm check && pnpm lint && pnpm test && pnpm validate` проверки
- `python3 scripts/check-overflow.py` после сборки: ни на одной странице нет
  горизонтальной прокрутки (сервер над `dist` скрипт поднимает сам)

## Переменные сборки

- `SITE_URL` (по умолчанию `https://steadya.app`)
- `BASE_PATH` (по умолчанию `/`)
- `PUBLIC_LOCALES` (по умолчанию `ru`)

## Публикация

Сайт живёт на GitHub Pages: https://avkudryashov.github.io/steadya/

Публикует workflow `.github/workflows/ci.yml`: на каждый push в `main` он
прогоняет все проверки, собирает сайт вместе с PDF и выкладывает `dist`.
Адрес задан переменными `SITE_URL` и `BASE_PATH` в начале workflow.

Переезд на свой домен: купить его, в DNS добавить записи на GitHub Pages,
в workflow поставить `SITE_URL` равным домену и `BASE_PATH: /`, в настройках
репозитория указать домен в Pages. Пути вида `/steadya/...` исчезнут сами,
они целиком собираются из `BASE_PATH`.
