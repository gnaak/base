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
LOG_FILE = LOG_DIR / "app.log"


class RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = get_request_id()
        return True


def setup_logging() -> None:
    formatter = logging.Formatter(LOG_FORMAT)

    # 1) 콘솔 — 개발 중 바로 보는 용도
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    sinks: list[logging.Handler] = [stream_handler]

    # 2) 파일 — 서버에 보존. 못 만들어도(읽기 전용 FS 등) 콘솔만으로 계속 동작한다.
    file_error: Optional[str] = None
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        file_handler = TimedRotatingFileHandler(
            str(LOG_FILE), when="midnight", backupCount=14, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        sinks.append(file_handler)
    except OSError as e:
        file_error = repr(e)

    # 레코드는 큐에만 넣고(논블로킹) 실제 콘솔·파일 쓰기는 리스너 스레드가 한다
    # — 이벤트 루프가 디스크 write에 막히지 않게.
    log_queue: queue.Queue = queue.Queue(-1)
    queue_handler = QueueHandler(log_queue)
    # request_id는 큐에 넣는 시점(요청 컨텍스트)에 읽어야 한다 — 리스너 스레드에는 contextvar가 없다
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
