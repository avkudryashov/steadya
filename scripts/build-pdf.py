#!/usr/bin/env python3
"""Печать листов из dist в готовые PDF, на этапе сборки.

Запуск: после `astro build` (входит в `pnpm build`), напрямую:
    python3 scripts/build-pdf.py

Поднимает локальный сервер на каталоге `dist` (свой, не dev-сервер проекта),
печатает каждый маршрут в PDF через playwright/chromium и проверяет число
страниц у каждого файла. `SKIP_PDF=1` пропускает генерацию и завершается
нулём (для быстрых прогонов `pnpm build:nopdf`).
"""

import http.server
import os
import socket
import sys
import threading
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
PDF_DIR = DIST / "ru" / "pdf"

# та же переменная, что читает astro.config.mjs: URL-адреса в разметке несут
# этот префикс, а файлы в dist лежат без него, как если бы весь dist
# смонтировали на этом префиксе на настоящем сервере.
_raw_base_path = os.environ.get("BASE_PATH", "/").strip("/")
BASE_PREFIX = f"/{_raw_base_path}" if _raw_base_path else ""

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


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class PrefixRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Отдаёт dist так, будто он смонтирован на BASE_PREFIX."""

    def translate_path(self, path: str) -> str:
        if BASE_PREFIX and path.startswith(BASE_PREFIX):
            path = path[len(BASE_PREFIX) :] or "/"
        return super().translate_path(path)


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

    port = free_port()
    handler = partial(PrefixRequestHandler, directory=str(DIST))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{port}{BASE_PREFIX}"

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    rows: list[tuple[str, int, float]] = []
    problems: list[str] = []

    try:
        with sync_playwright() as p:
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
    finally:
        server.shutdown()

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
