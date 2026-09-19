# app/core/utils/http_client.py
import time
from http.cookiejar import CookieJar
from typing import Any

import httpx

from app.core.logging.logger import get_logger
from app.core.utils.response import fail

logger = get_logger("http.outbound")

# ⚠️ 이 모듈 어디서도 헤더·바디 전문은 로깅하지 말 것 — Authorization 토큰,
#    client_secret 등 민감정보가 들어있다. (에러 바디는 request_json이 앞 300자만 남긴다)


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


# 앱 전체가 공유하는 단일 아웃바운드 클라이언트 (redis.py와 같은 lazy 싱글톤).
# 커넥션 풀 재사용 + 타임아웃 기본값 + 모든 외부 호출 로깅. lifespan이 기동 시 한 번
# 호출해 앱 이벤트 루프에 바인딩하고, 종료 시 close_http_client()로 닫는다.
_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            cookies=_NullCookieJar(),
            event_hooks={"request": [_stamp_request], "response": [_log_response]},
        )
    return _client


async def close_http_client() -> None:
    """lifespan 종료 시 호출. 한 번도 사용하지 않았으면 아무것도 하지 않는다."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def request_json(
    method: str,
    url: str,
    *,
    context: str,
    error_code: str,
    fail_status: int,
    **kwargs: Any,
) -> dict:
    """외부 API를 호출해 JSON(dict)을 돌려주는 공통 래퍼.

    네트워크 오류·에러 상태코드·JSON 아닌 응답을 전부 fail()로 변환한다.
    업스트림 에러 원문은 서버 로그에만 남긴다 (클라이언트에는 요약만).

    - context: 로그·에러 메시지에 쓸 호출 설명 (예: "google token")
    - error_code / fail_status: 업스트림이 에러 상태코드를 줬을 때 클라이언트로 나갈 값
    """
    client = get_http_client()

    try:
        resp = await client.request(method, url, **kwargs)
    except httpx.RequestError as e:
        logger.warning("%s request error: %r", context, e)
        raise fail(f"{context} request failed", "UPSTREAM_UNREACHABLE", 502)

    if resp.is_error:
        logger.warning("%s failed: %d %s", context, resp.status_code, resp.text[:300])
        raise fail(f"{context} request failed", error_code, fail_status)

    try:
        return resp.json()
    except ValueError:
        logger.warning("%s returned non-JSON body: %s", context, resp.text[:300])
        raise fail(f"{context} invalid response", "UPSTREAM_INVALID_RESPONSE", 502)
