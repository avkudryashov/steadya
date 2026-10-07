"""Локальный сервер над каталогом `dist` для проверочных скриптов.

Отдаёт сборку так, будто её смонтировали на BASE_PATH: ссылки в разметке несут
этот префикс, а файлы на диске лежат без него. Поднимается внутри самого
скрипта, поэтому проверки не зависят от отдельно запущенного dev-сервера и не
конфликтуют с ним за порт.
"""

import http.server
import os
import socket
import threading
from contextlib import contextmanager
from functools import partial
from pathlib import Path
from typing import Iterator

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# та же переменная, что читает astro.config.mjs
_raw_base_path = os.environ.get("BASE_PATH", "/").strip("/")
BASE_PREFIX = f"/{_raw_base_path}" if _raw_base_path else ""


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

    def log_message(self, format: str, *args) -> None:
        # Удачные запросы молчат: их сотни на страницу. Видны только ошибки,
        # по которым и ищут причину пустой картинки или битой ссылки.
        status = args[1] if len(args) > 1 else ""
        if str(status).startswith(("4", "5")):
            super().log_message(format, *args)


@contextmanager
def serve_dist() -> Iterator[str]:
    """Поднимает сервер над `dist` и отдаёт базовый URL вместе с префиксом."""
    port = free_port()
    handler = partial(PrefixRequestHandler, directory=str(DIST))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}{BASE_PREFIX}"
    finally:
        server.shutdown()
