import logging
import time
import uuid
from fastapi import FastAPI

from app.core.logging.context import set_request_id, get_request_id
from app.core.logging.logger import get_logger

logger = get_logger("http.access")

# 헬스체크 경로 — 라우트 선언(main.py)과 액세스 로그 제외가 이 상수 하나를 공유한다
HEALTH_PATH = "/api/health"

# 액세스 로그 제외: LB 헬스체크 노이즈 + 정적 파일 대량 요청
ACCESS_LOG_EXCLUDE = {HEALTH_PATH}
ACCESS_LOG_EXCLUDE_PREFIXES = ("/media/",)

# 파일에 14일 보존되는 로그라 쿼리스트링의 민감 값은 가린다 (OAuth code 등)
SENSITIVE_QUERY_KEYS = {"code", "state", "token", "access_token", "refresh_token", "id_token"}


def _redact_query(query: str) -> str:
    parts = []
    for pair in query.split("&"):
        key = pair.split("=", 1)[0]
        parts.append(f"{key}=***" if key.lower() in SENSITIVE_QUERY_KEYS else pair)
    return "&".join(parts)


class RequestIdMiddleware:
    """가장 바깥쪽 사용자 미들웨어 — request_id 발급 + 액세스 로그(latency 포함) 담당.

    단, 미처리 예외의 500 응답은 Starlette이 이보다 더 바깥(ServerErrorMiddleware)에서
    보내기 때문에 여기를 거치지 않는다 — 그 경우 x-request-id·CORS 헤더는
    exception/handler.py의 unhandled_handler가 직접 붙인다.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            set_request_id(str(uuid.uuid4()))

        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        status = "?"
        elapsed_ms = None

        async def send_with_header(message):
            nonlocal status, elapsed_ms
            if message["type"] == "http.response.start":
                status = message["status"]
                # 응답 시작 시점 기준 — x-process-time 헤더와 액세스 로그가 같은 값을 쓴다
                elapsed_ms = (time.perf_counter() - start) * 1000
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", get_request_id().encode()))
                headers.append((b"x-process-time", f"{elapsed_ms:.1f}ms".encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_header)
        except BaseException:
            # 미처리 예외 → 더 바깥의 ServerErrorMiddleware가 500을 보낸다
            status = 500
            raise
        finally:
            path = scope.get("path", "")
            if path not in ACCESS_LOG_EXCLUDE and not path.startswith(ACCESS_LOG_EXCLUDE_PREFIXES):
                if elapsed_ms is None:
                    elapsed_ms = (time.perf_counter() - start) * 1000
                query = scope.get("query_string", b"").decode("utf-8", "replace")
                target = f"{path}?{_redact_query(query)}" if query else path
                client = scope.get("client")
                logger.info(
                    "%s %s -> %s (%.1fms) [%s]",
                    scope.get("method", "-"),
                    target,
                    status,
                    elapsed_ms,
                    client[0] if client else "-",
                    # status를 메시지 문자열이 아니라 레코드 속성으로도 실어 보낸다.
                    # logging/config.py의 채널 필터가 이걸 보고 access.log / error.log를 가른다
                    # — 포맷을 바꿔도 분기가 깨지지 않게.
                    extra={"status_code": status},
                )


def setup_request_id(app: FastAPI):
    # 이 미들웨어가 액세스 로그를 대체하므로 uvicorn 기본 액세스 로그도 여기서 끈다
    # (요청당 두 줄 중복 방지 — 끄는 쪽과 대체하는 쪽이 분리되지 않도록 같은 파일에 둔다)
    logging.getLogger("uvicorn.access").propagate = False
    app.add_middleware(RequestIdMiddleware)
