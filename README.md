# Steadya

Домашняя программа тренировок для женщин 60+: устойчивость, сила, осанка.

## Публикация

Сайт живёт на GitHub Pages: https://avkudryashov.github.io/steadya/

Публикует workflow `.github/workflows/ci.yml`: на каждый push в `main` он
прогоняет все проверки, собирает сайт вместе с PDF и выкладывает `dist`.
Адрес задан переменными `SITE_URL` и `BASE_PATH` в начале workflow.

Переезд на свой домен: купить его, в DNS добавить записи на GitHub Pages,
в workflow поставить `SITE_URL` равным домену и `BASE_PATH: /`, в настройках
репозитория указать домен в Pages. Пути вида `/steadya/...` исчезнут сами,
они целиком собираются из `BASE_PATH`.
