#!/usr/bin/env python3
"""Проверка: ни на одной странице нет горизонтальной прокрутки.

Запуск после `pnpm build`, сервер скрипт поднимает сам:
    python3 scripts/check-overflow.py

Чтобы проверить работающий dev-сервер, его адрес передаётся аргументом:
    python3 scripts/check-overflow.py http://127.0.0.1:4321

Скрипт обходит основные маршруты на типовых ширинах экрана и сообщает о любом
элементе, который шире своей области и прокручивается вбок, а также о прокрутке
страницы целиком. Код возврата 1, если найдена хотя бы одна проблема.
"""

import contextlib
import sys

from playwright.sync_api import sync_playwright

from dist_server import DIST, serve_dist

# маршруты без языка: проверяются на каждом собранном языке, длинные слова
# в немецком или польском ломают вёрстку там, где русский помещается.
ROUTES = [
    "",
    "day/monday/",
    "day/tuesday/",
    "day/wednesday/",
    "day/thursday/",
    "day/friday/",
    "day/saturday/",
    "day/sunday/",
    "exercises/",
    "exercise/chair-squat/",
    "exercise/step-up/",
    "program/",
    "tests/",
    "more/",
    "safety/",
    "nutrition/",
    "equipment/",
    "about/",
    "print/diary/",
    "print/all/",
]



def built_langs() -> list[str]:
    """Языки в собранном dist; для dev-сервера только русский."""
    if not DIST.is_dir():
        return ["ru"]
    return sorted(d.name for d in DIST.iterdir() if (d / "day").is_dir())


WIDTHS = [320, 390, 768, 1024, 1440, 2400]

PROBE = """
(() => {
  const over = [];
  document.querySelectorAll('*').forEach((el) => {
    const cs = getComputedStyle(el);
    const scrollable = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
    if (scrollable && el.scrollWidth > el.clientWidth + 1) {
      over.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className : '',
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      });
    }
  });
  return {
    docScroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    over,
  };
})()
"""


def main() -> int:
    # Без аргумента проверяется собранный сайт: свой сервер не зависит от
    # запущенного dev-сервера и не конфликтует с ним за порт.
    given = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else None
    if given is None and not DIST.is_dir():
        print(f"ошибка: каталог сборки не найден: {DIST}", file=sys.stderr)
        return 1

    with contextlib.nullcontext(given) if given else serve_dist() as base:
        return check(base)


def check(base: str) -> int:
    problems = 0
    routes = [f"/{lang}/{route}" for lang in built_langs() for route in ROUTES]
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in WIDTHS:
            page = browser.new_page(viewport={"width": width, "height": 900})
            for route in routes:
                page.goto(base + route, wait_until="networkidle")
                result = page.evaluate(PROBE)
                if result["docScroll"] > result["viewport"] + 1:
                    problems += 1
                    print(
                        f"FAIL {width}px {route}: страница шире экрана "
                        f"({result['docScroll']} > {result['viewport']})"
                    )
                for item in result["over"]:
                    problems += 1
                    print(
                        f"FAIL {width}px {route}: <{item['tag']} class=\"{item['cls']}\"> "
                        f"прокручивается вбок ({item['scrollWidth']} > {item['clientWidth']})"
                    )
            page.close()
        browser.close()
    if problems:
        print(f"\nНайдено проблем: {problems}")
        return 1
    print(f"Прокрутки нет: {len(routes)} маршрутов × {len(WIDTHS)} ширин, всё чисто")
    return 0


if __name__ == "__main__":
    sys.exit(main())
