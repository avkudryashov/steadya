#!/usr/bin/env python3
"""Печать листов из dist в готовые PDF, на этапе сборки.

Запуск: после `astro build` (входит в `pnpm build`), напрямую:
    python3 scripts/build-pdf.py

Поднимает локальный сервер на каталоге `dist` (свой, не dev-сервер проекта),
печатает каждый маршрут в PDF через playwright/chromium и проверяет число
страниц у каждого файла. `SKIP_PDF=1` пропускает генерацию и завершается
нулём (для быстрых прогонов `pnpm build:nopdf`).
"""

import os
import sys

from dist_server import DIST, serve_dist

PDF_DIR = DIST / "ru" / "pdf"

# маршрут, имя файла, ожидаемое число страниц (None: число не фиксировано,
# лист с картинками может занять больше одной страницы).
# Печатаются настоящие страницы дня и тестов (не отдельные print-листы: с
# S4 печатный вид это то же самое, что на экране, через `@media print`).
ROUTES = [
    ("/ru/day/monday/", "day-monday.pdf", None),
    ("/ru/day/tuesday/", "day-tuesday.pdf", None),
    ("/ru/day/wednesday/", "day-wednesday.pdf", None),
    ("/ru/day/thursday/", "day-thursday.pdf", None),
    ("/ru/day/friday/", "day-friday.pdf", None),
    ("/ru/day/saturday/", "day-saturday.pdf", None),
    ("/ru/day/sunday/", "day-sunday.pdf", None),
    ("/ru/tests/", "tests.pdf", None),
    ("/ru/print/diary/", "diary.pdf", 1),
]

# сводный файл: маршрут и имя, число страниц не фиксируем константой, а
# сверяем с суммой страниц отдельных файлов выше (см. main()).
ALL_ROUTE = ("/ru/print/all/", "program.pdf")


def count_pages(data: bytes) -> int:
    return data.count(b"/Type /Page") - data.count(b"/Type /Pages")


def main() -> int:
    if os.environ.get("SKIP_PDF") == "1":
        print("SKIP_PDF=1: генерация PDF пропущена")
        return 0

    if not DIST.is_dir():
        print(f"ошибка: каталог сборки не найден: {DIST}", file=sys.stderr)
        return 1

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "ошибка: playwright не установлен, PDF не сгенерированы. "
            "Установить: pip install playwright && playwright install chromium",
            file=sys.stderr,
        )
        return 1

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    rows: list[tuple[str, int, float]] = []
    problems: list[str] = []

    with serve_dist() as base, sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as exc:  # noqa: BLE001, нужно понятное сообщение, не трейс
            print(f"ошибка: chromium недоступен: {exc}", file=sys.stderr)
            return 1
        page = browser.new_page()

        def render(route: str, filename: str) -> int:
            out = PDF_DIR / filename
            page.goto(base + route, wait_until="networkidle")
            # `loading="lazy"` бережёт трафик в браузере, но
            # headless-печать не проходит через настоящий скролл, так
            # что картинки ниже первого экрана без этого никогда не
            # начинают загружаться и остаются пустыми в PDF.
            page.evaluate(
                "document.querySelectorAll('img[loading=\"lazy\"]')"
                ".forEach((img) => { img.loading = 'eager'; })"
            )
            page.wait_for_function(
                "Array.from(document.images).every((img) => img.complete)"
            )
            page.pdf(
                path=str(out),
                format="A4",
                print_background=False,
                margin={
                    "top": "12mm",
                    "right": "12mm",
                    "bottom": "12mm",
                    "left": "12mm",
                },
                prefer_css_page_size=True,
            )
            data = out.read_bytes()
            pages = count_pages(data)
            size_kb = len(data) / 1024
            rows.append((filename, pages, size_kb))
            return pages

        pages_by_file: dict[str, int] = {}
        for route, filename, expected_pages in ROUTES:
            pages = render(route, filename)
            pages_by_file[filename] = pages
            if expected_pages is not None and pages != expected_pages:
                problems.append(
                    f"{filename}: ожидалось страниц {expected_pages}, получено {pages}"
                )

        all_route, all_filename = ALL_ROUTE
        all_pages = render(all_route, all_filename)
        individual_sum = sum(pages_by_file.values())
        if abs(all_pages - individual_sum) > len(ROUTES):
            problems.append(
                f"{all_filename}: сумма страниц отдельных файлов {individual_sum}, "
                f"а в сводном файле {all_pages}, разница больше страницы на раздел"
            )
        browser.close()

    print(f"{'файл':<18}{'страниц':>10}{'кб':>10}")
    for filename, pages, size_kb in rows:
        print(f"{filename:<18}{pages:>10}{size_kb:>9.1f}")

    if problems:
        print()
        for problem in problems:
            print(f"ошибка: {problem}", file=sys.stderr)
        return 1

    print(f"\nPDF готовы: {len(rows)} файлов в {PDF_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
