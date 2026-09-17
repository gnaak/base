import atexit
import logging
import os
import queue
from logging.handlers import QueueHandler, QueueListener, TimedRotatingFileHandler
from typing import Optional

from app.core.config.settings import settings
from app.core.logging.context import get_request_id

LOG_FORMAT = "[%(asctime)s] [%(levelname)s] [req:%(request_id)s] [%(name)s] %(message)s"

# backend/ 루트에 고정 — CWD가 어디든 같은 곳에 쌓인다. 자정 로테이션, 14일 보관.
# ⚠️ 멀티 프로세스(--workers N)로 돌리면 파일 로테이션이 충돌한다 — 그땐 파일 핸들러 대신
#    stdout 수집(systemd/docker 로그 드라이버)으로 전환할 것. run.sh 기본 실행은 단일 프로세스다.
LOG_DIR = settings.BASE_DIR / "logs"

BACKUP_DAYS = 14

# 도메인별로 파일을 더 쪼개고 싶을 때 여기에 추가한다. {파일명 stem: 로거 이름 프리픽스}
# 해당 프리픽스 하위 로거는 전용 파일과 app.log에 **동시에** 남는다.
#   "anthropic": "app.module.infra.claude",
EXTRA_LOG_CHANNELS: dict[str, str] = {
    "openai": "app.module.infra.gpt",
}


class RequestIdFilter(logging.Filter):
    """레코드에 현재 요청 ID를 붙인다.

    반드시 **QueueHandler 쪽에** 달아야 한다 — 큐에 넣는 시점은 요청 컨텍스트 안이지만,
    실제로 파일을 쓰는 리스너 스레드에는 contextvar가 없다.
    """

    def filter(self, record):
        record.request_id = get_request_id()
        return True


def _access_status(record: logging.LogRecord) -> Optional[int]:
    """액세스 로그 레코드의 응답 status. 액세스 로그가 아니면 None.

    RequestIdMiddleware가 `extra={"status_code": ...}`로 실어 보낸다.
    메시지 문자열을 파싱하지 않으므로 로그 포맷을 바꿔도 분기가 깨지지 않는다.
    """
    status = getattr(record, "status_code", None)
    if status is None:
        return None
    try:
        return int(status)
    except (ValueError, TypeError):
        # 응답이 시작되지 못한 경우 status가 "?"로 들어온다 — app.log에만 남긴다
        return None


class AccessOkFilter(logging.Filter):
    """액세스 로그 중 status < 400만 통과."""

    def filter(self, record: logging.LogRecord) -> bool:
        status = _access_status(record)
        return status is not None and 200 <= status < 400


class ErrorFilter(logging.Filter):
    """액세스 로그 status >= 400, 또는 일반 로그 ERROR 이상."""

    def filter(self, record: logging.LogRecord) -> bool:
        status = _access_status(record)
        if status is not None:
            return status >= 400
        return record.levelno >= logging.ERROR


class LoggerPrefixFilter(logging.Filter):
    """특정 로거 프리픽스에서 나온 레코드만 통과."""

    def __init__(self, prefix: str):
        super().__init__()
        self.prefix = prefix

    def filter(self, record: logging.LogRecord) -> bool:
        return record.name == self.prefix or record.name.startswith(self.prefix + ".")


def _file_sink(filename: str, *filters: logging.Filter) -> logging.Handler:
    handler = TimedRotatingFileHandler(
        str(LOG_DIR / filename), when="midnight", backupCount=BACKUP_DAYS, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    for f in filters:
        handler.addFilter(f)
    return handler


def setup_logging() -> None:
    formatter = logging.Formatter(LOG_FORMAT)

    # 1) 콘솔 — 개발 중 바로 보는 용도. 채널 구분 없이 전부 흘린다.
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    sinks: list[logging.Handler] = [stream_handler]

    # 2) 파일 — 서버에 보존. 못 만들어도(읽기 전용 FS 등) 콘솔만으로 계속 동작한다.
    #
    #    채널을 나누는 건 핸들러에 달린 필터다. 로거에 핸들러를 직접 붙이지 않으므로
    #    파일 쓰기는 전부 리스너 스레드에 남아 있는다(= 이벤트 루프를 막지 않는다).
    #
    #      app.log     전부
    #      access.log  2xx/3xx 요청만        → 트래픽 확인용
    #      error.log   4xx/5xx + ERROR 이상  → 서버에서 이것만 tail 하면 된다
    file_error: Optional[str] = None
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        sinks.append(_file_sink("app.log"))
        sinks.append(_file_sink("access.log", AccessOkFilter()))
        sinks.append(_file_sink("error.log", ErrorFilter()))
        for stem, prefix in EXTRA_LOG_CHANNELS.items():
            sinks.append(_file_sink(f"{stem}.log", LoggerPrefixFilter(prefix)))
    except OSError as e:
        file_error = repr(e)

    # 레코드는 큐에만 넣고(논블로킹) 실제 콘솔·파일 쓰기는 리스너 스레드가 한다.
    log_queue: queue.Queue = queue.Queue(-1)
    queue_handler = QueueHandler(log_queue)
    queue_handler.addFilter(RequestIdFilter())

    listener = QueueListener(log_queue, *sinks, respect_handler_level=True)
    listener.start()
    atexit.register(listener.stop)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.handlers.clear()
    root_logger.addHandler(queue_handler)

    # uvicorn 로거를 root로 흘려보낸다 (같은 포맷·같은 파일).
    # uvicorn.access를 끄는 건 대체 액세스 로그를 제공하는 쪽(middleware/request_id.py)의 몫이다.
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(logger_name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True

    if file_error:
        logging.getLogger(__name__).warning(
            "파일 로그 핸들러 생성 실패 — 콘솔만 사용: %s", file_error
        )
