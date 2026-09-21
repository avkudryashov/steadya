#!/usr/bin/env python3
"""Проверка: ни на одной странице нет горизонтальной прокрутки.

Запуск: сначала `pnpm dev` (или `pnpm preview`), затем
    python3 scripts/check-overflow.py [base-url]

Скрипт обходит основные маршруты на типовых ширинах экрана и сообщает о любом
элементе, который шире своей области и прокручивается вбок, а также о прокрутке
страницы целиком. Код возврата 1, если найдена хотя бы одна проблема.
"""

import sys

from playwright.sync_api import sync_playwright

ROUTES = [
    "/ru/",
    "/ru/day/monday/",
    "/ru/day/tuesday/",
    "/ru/day/wednesday/",
    "/ru/day/thursday/",
    "/ru/day/friday/",
    "/ru/day/saturday/",
    "/ru/day/sunday/",
    "/ru/exercises/",
    "/ru/exercise/chair-squat/",
    "/ru/exercise/step-up/",
    "/ru/program/",
    "/ru/tests/",
    "/ru/more/",
    "/ru/safety/",
    "/ru/nutrition/",
    "/ru/equipment/",
    "/ru/about/",
    "/ru/print/diary/",
    "/ru/print/all/",
]

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
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4322"
    problems = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in WIDTHS:
            page = browser.new_page(viewport={"width": width, "height": 900})
            for route in ROUTES:
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
    print(f"Прокрутки нет: {len(ROUTES)} маршрутов × {len(WIDTHS)} ширин, всё чисто")
    return 0


if __name__ == "__main__":
    sys.exit(main())
