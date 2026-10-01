# app/core/utils/http_client.py
import asyncio
import time
from email.utils import parsedate_to_datetime
from http.cookiejar import CookieJar
from typing import Any

import httpx

from app.core.logging.logger import get_logger
from app.core.utils.error_code import ErrorCode
from app.core.utils.response import fail

logger = get_logger("http.outbound")

# ⚠️ 이 모듈 어디서도 헤더·바디 전문은 로깅하지 말 것 — Authorization 토큰,
#    client_secret 등 민감정보가 들어있다. (에러 바디는 request_json이 앞 300자만 남긴다)

# 재시도 사이에 기다리는 최대 시간. 업체가 Retry-After 로 더 길게 달라고 해도 여기서 자른다 —
# 사용자 요청 하나가 그 시간만큼 붙잡혀 있기 때문이다.
MAX_RETRY_WAIT_SECONDS = 10.0

# 업체가 "지금은 못 받는다"고 답한 것 — 요청이 처리되지 않았으므로 다시 보내도 된다
_RETRYABLE_STATUSES = {429, 503}

# 요청이 업체에 **닿지 않은** 실패 — 다시 보내도 중복 처리가 생기지 않는다
_NOT_SENT_ERRORS = (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout, httpx.UnsupportedProtocol)

# 테스트가 바꿔 끼운다 (재시도 대기를 실제로 기다리지 않게)
_sleep = asyncio.sleep


class UpstreamError(Exception):
    """업체가 4xx·5xx 로 답했을 때 그 내용을 호출부에 넘긴다 (`upstream_errors=True` 일 때만).

    결제 거절·잔액 부족처럼 **업체 응답 본문에 업무 의미가 있는** 오류를 호출부가 직접 처리하려고 쓴다.
    `body` 는 JSON 이면 dict, 아니면 앞 300자 문자열이다. 클라이언트에 그대로 내보내지 말 것.
    """

    def __init__(self, status_code: int, body: Any, context: str):
        super().__init__(f"{context} upstream error {status_code}")
        self.status_code = status_code
        self.body = body
        self.context = context


class _NullCookieJar(CookieJar):
    """응답의 Set-Cookie를 저장하지 않는 쿠키 저장소.

    공용 클라이언트는 여러 사용자의 요청을 처리하므로, 쿠키를 저장하면
    A 사용자의 업스트림 세션 쿠키가 B 사용자의 요청에 실려 나가는 사고가 난다.
    """

    def extract_cookies(self, response, request):
        pass


async def _stamp_request(request: httpx.Request) -> None:
    # 로그는 응답 훅에서 한 줄로 남긴다 — 여기선 시작 시각만 기록
    request.extensions["hook_start"] = time.perf_counter()


async def _log_response(response: httpx.Response) -> None:
    start = response.request.extensions.get("hook_start")
    elapsed_ms = (time.perf_counter() - start) * 1000 if start is not None else -1.0
    log = logger.info if response.status_code < 400 else logger.warning
    log(
        "%s %s -> %d (%.1fms)",
        response.request.method,
        response.request.url,
        response.status_code,
        elapsed_ms,
    )


def _build_client(transport: httpx.AsyncBaseTransport | None = None) -> httpx.AsyncClient:
    """공용 클라이언트의 설정. 테스트는 `transport` 에 `httpx.MockTransport` 를 넣어 업체만 바꿔 끼운다."""
    return httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, connect=5.0),
        cookies=_NullCookieJar(),
        event_hooks={"request": [_stamp_request], "response": [_log_response]},
        transport=transport,
    )


# 앱 전체가 공유하는 단일 아웃바운드 클라이언트 (redis.py와 같은 lazy 싱글톤).
# 커넥션 풀 재사용 + 타임아웃 기본값 + 모든 외부 호출 로깅. lifespan이 기동 시 한 번
# 호출해 앱 이벤트 루프에 바인딩하고, 종료 시 close_http_client()로 닫는다.
_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = _build_client()
    return _client


async def close_http_client() -> None:
    """lifespan 종료 시 호출. 한 번도 사용하지 않았으면 아무것도 하지 않는다."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _retry_after_seconds(resp: httpx.Response, attempt: int) -> float:
    """`Retry-After`(초 또는 HTTP 날짜)를 따르고, 없으면 0.5·1·2초… 로 늘린다.

    상한은 MAX_RETRY_WAIT_SECONDS.
    """
    header = resp.headers.get("retry-after")
    wait: float | None = None
    if header:
        try:
            wait = float(header)
        except ValueError:
            try:
                wait = parsedate_to_datetime(header).timestamp() - time.time()
            except (TypeError, ValueError):
                wait = None
    if wait is None:
        wait = 0.5 * (2**attempt)
    return max(0.0, min(wait, MAX_RETRY_WAIT_SECONDS))


def _error_body(resp: httpx.Response) -> Any:
    try:
        return resp.json()
    except ValueError:
        return resp.text[:300]


async def request_json(
    method: str,
    url: str,
    *,
    context: str,
    error_code: str,
    fail_status: int,
    retries: int = 0,
    upstream_errors: bool = False,
    **kwargs: Any,
) -> dict:
    """외부 API를 호출해 JSON(dict)을 돌려주는 공통 래퍼.

    네트워크 오류·에러 상태코드·JSON 아닌 응답을 전부 fail()로 변환한다.
    업스트림 에러 원문은 서버 로그에만 남긴다 (클라이언트에는 요약만).

    - context: 로그·에러 메시지에 쓸 호출 설명 (예: "google token")
    - error_code / fail_status: 업스트림이 에러 상태코드를 줬을 때 클라이언트로 나갈 값
    - retries: **요청이 처리되지 않은 게 확실한 경우만** 다시 보낸다 — 연결 실패(요청이 안 나감)와
      429·503(업체가 거절). 응답을 못 받은 타임아웃은 결과를 모르므로 **절대 다시 보내지 않는다**.
      그래서 결제처럼 멱등하지 않은 요청에도 retries 를 줘도 이중 처리가 생기지 않는다
    - upstream_errors: True 면 업체의 4xx·5xx 를 fail() 로 바꾸지 않고 `UpstreamError` 로 던진다.
      결제 거절 사유처럼 본문을 호출부가 읽어야 할 때 쓴다 (429·503 은 재시도가 끝난 뒤에도 fail())

    실패할 때 클라이언트로 나가는 errorCode:

    | 상황 | 상태 | errorCode | 다시 해도 되나 |
    | --- | --- | --- | --- |
    | 연결 실패 (요청이 안 나감) | 502 | UPSTREAM_UNREACHABLE | 된다 |
    | 응답 대기 중 끊김·타임아웃 (**결과 불명**) | 504 | UPSTREAM_TIMEOUT | 업체 쪽 결과를 먼저 조회할 것 |
    | 업체가 429·503 (재시도 소진) | 503 | UPSTREAM_RATE_LIMITED | 잠시 뒤 |
    | 업체가 그 밖의 에러 | fail_status | error_code | 호출부 판단 |
    | JSON 아닌 응답 | 502 | UPSTREAM_INVALID_RESPONSE | — |
    """
    client = get_http_client()

    attempt = 0
    while True:
        try:
            resp = await client.request(method, url, **kwargs)
        except _NOT_SENT_ERRORS as e:
            if attempt < retries:
                attempt += 1
                logger.warning("%s not sent (%r) — retry %d/%d", context, e, attempt, retries)
                await _sleep(min(0.5 * (2 ** (attempt - 1)), MAX_RETRY_WAIT_SECONDS))
                continue
            logger.warning("%s request error: %r", context, e)
            raise fail(f"{context} request failed", ErrorCode.UPSTREAM_UNREACHABLE, 502)
        except httpx.RequestError as e:
            # 요청은 나갔는데 응답을 못 받았다 — 업체가 처리했는지 알 수 없다
            logger.warning("%s result unknown: %r", context, e)
            raise fail(f"{context} timed out", ErrorCode.UPSTREAM_TIMEOUT, 504)

        if resp.status_code in _RETRYABLE_STATUSES:
            if attempt < retries:
                wait = _retry_after_seconds(resp, attempt)
                attempt += 1
                logger.warning(
                    "%s got %d — retry %d/%d in %.1fs", context, resp.status_code, attempt, retries, wait
                )
                await _sleep(wait)
                continue
            logger.warning("%s rate limited: %d", context, resp.status_code)
            raise fail(f"{context} rate limited", ErrorCode.UPSTREAM_RATE_LIMITED, 503)
        break

    if resp.is_error:
        logger.warning("%s failed: %d %s", context, resp.status_code, resp.text[:300])
        if upstream_errors:
            raise UpstreamError(resp.status_code, _error_body(resp), context)
        raise fail(f"{context} request failed", error_code, fail_status)

    try:
        return resp.json()
    except ValueError:
        logger.warning("%s returned non-JSON body: %s", context, resp.text[:300])
        raise fail(f"{context} invalid response", ErrorCode.UPSTREAM_INVALID_RESPONSE, 502)
