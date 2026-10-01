"""외부 호출 래퍼 `request_json` — 업체만 `httpx.MockTransport` 로 바꿔 끼운다.

라우터 테스트가 아니라서 DB·client 픽스처를 쓰지 않는다. 외부 업체는 진짜로 부를 수 없으니
전송 계층(MockTransport)만 가짜고, 재시도·에러 변환·로그 경로는 진짜 코드를 탄다.
"""

import httpx
import pytest
from fastapi import HTTPException

from app.core.utils import http_client as hc
from app.core.utils.error_code import ErrorCode

URL = "https://upstream.example.com/v1/pay"


@pytest.fixture
def upstream(monkeypatch):
    """업체 응답을 테스트마다 정한다. `upstream(handler)` → 호출 기록 리스트를 돌려준다."""
    waits: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        waits.append(seconds)

    monkeypatch.setattr(hc, "_sleep", fake_sleep)

    def install(handler):
        calls: list[httpx.Request] = []

        def recording(request: httpx.Request) -> httpx.Response:
            calls.append(request)
            return handler(request, len(calls))

        monkeypatch.setattr(hc, "_client", hc._build_client(httpx.MockTransport(recording)))
        return calls

    install.waits = waits
    return install


async def call(**kw):
    return await hc.request_json(
        "POST", URL, context="pg pay", error_code="PG_FAILED", fail_status=402, json={"amount": 1000}, **kw
    )


def error_code_of(exc: pytest.ExceptionInfo) -> str:
    assert isinstance(exc.value, HTTPException)
    return exc.value.error_code


async def test_정상_응답이면_JSON을_돌려준다(upstream):
    upstream(lambda req, n: httpx.Response(200, json={"ok": True}))
    assert await call() == {"ok": True}


async def test_연결_실패는_502_UNREACHABLE(upstream):
    def handler(req, n):
        raise httpx.ConnectError("refused", request=req)

    upstream(handler)
    with pytest.raises(HTTPException) as exc:
        await call()
    assert exc.value.status_code == 502
    assert error_code_of(exc) == ErrorCode.UPSTREAM_UNREACHABLE


async def test_읽기_타임아웃은_결과_불명이라_504_TIMEOUT(upstream):
    def handler(req, n):
        raise httpx.ReadTimeout("slow", request=req)

    upstream(handler)
    with pytest.raises(HTTPException) as exc:
        await call()
    assert exc.value.status_code == 504
    assert error_code_of(exc) == ErrorCode.UPSTREAM_TIMEOUT


async def test_타임아웃은_retries가_있어도_다시_보내지_않는다(upstream):
    """요청이 업체에 닿았을 수 있다 — 다시 보내면 이중결제가 난다."""

    def handler(req, n):
        raise httpx.ReadTimeout("slow", request=req)

    calls = upstream(handler)
    with pytest.raises(HTTPException) as exc:
        await call(retries=3)
    assert error_code_of(exc) == ErrorCode.UPSTREAM_TIMEOUT
    assert len(calls) == 1


async def test_연결_실패는_retries만큼_다시_보내고_성공하면_돌려준다(upstream):
    def handler(req, n):
        if n == 1:
            raise httpx.ConnectError("refused", request=req)
        return httpx.Response(200, json={"ok": n})

    calls = upstream(handler)
    assert await call(retries=2) == {"ok": 2}
    assert len(calls) == 2


async def test_429는_Retry_After만큼_기다렸다가_다시_보낸다(upstream):
    def handler(req, n):
        if n == 1:
            return httpx.Response(429, headers={"Retry-After": "3"})
        return httpx.Response(200, json={"ok": True})

    calls = upstream(handler)
    assert await call(retries=1) == {"ok": True}
    assert len(calls) == 2
    assert upstream.waits == [3.0]


async def test_Retry_After가_너무_길면_상한에서_자른다(upstream):
    def handler(req, n):
        if n == 1:
            return httpx.Response(429, headers={"Retry-After": "3600"})
        return httpx.Response(200, json={"ok": True})

    upstream(handler)
    await call(retries=1)
    assert upstream.waits == [hc.MAX_RETRY_WAIT_SECONDS]


async def test_429가_계속되면_재시도_뒤_503_RATE_LIMITED(upstream):
    calls = upstream(lambda req, n: httpx.Response(429))
    with pytest.raises(HTTPException) as exc:
        await call(retries=2)
    assert exc.value.status_code == 503
    assert error_code_of(exc) == ErrorCode.UPSTREAM_RATE_LIMITED
    assert len(calls) == 3


async def test_retries를_안_주면_429에서_바로_멈춘다(upstream):
    calls = upstream(lambda req, n: httpx.Response(429))
    with pytest.raises(HTTPException) as exc:
        await call()
    assert error_code_of(exc) == ErrorCode.UPSTREAM_RATE_LIMITED
    assert len(calls) == 1


async def test_업체_4xx는_호출부의_error_code로(upstream):
    upstream(lambda req, n: httpx.Response(400, json={"code": "CARD_DECLINED"}))
    with pytest.raises(HTTPException) as exc:
        await call()
    assert exc.value.status_code == 402
    assert error_code_of(exc) == "PG_FAILED"


async def test_upstream_errors면_4xx_본문을_UpstreamError로_넘긴다(upstream):
    """결제 거절 사유처럼 업체 본문을 호출부가 읽어야 할 때."""
    upstream(lambda req, n: httpx.Response(400, json={"code": "CARD_DECLINED", "message": "한도 초과"}))
    with pytest.raises(hc.UpstreamError) as exc:
        await call(upstream_errors=True)
    assert exc.value.status_code == 400
    assert exc.value.body == {"code": "CARD_DECLINED", "message": "한도 초과"}


async def test_upstream_errors여도_JSON_아닌_에러_본문은_앞_300자만(upstream):
    upstream(lambda req, n: httpx.Response(500, text="x" * 1000))
    with pytest.raises(hc.UpstreamError) as exc:
        await call(upstream_errors=True)
    assert exc.value.body == "x" * 300


async def test_JSON이_아닌_정상_응답은_502_INVALID_RESPONSE(upstream):
    upstream(lambda req, n: httpx.Response(200, text="<html>maintenance</html>"))
    with pytest.raises(HTTPException) as exc:
        await call()
    assert exc.value.status_code == 502
    assert error_code_of(exc) == ErrorCode.UPSTREAM_INVALID_RESPONSE


async def test_업체가_준_쿠키를_다음_요청에_싣지_않는다(upstream):
    """공용 클라이언트라 A 사용자의 업체 세션 쿠키가 B 요청에 실리면 사고다."""

    def handler(req, n):
        if n == 1:
            return httpx.Response(200, json={}, headers={"Set-Cookie": "sid=secret; Path=/"})
        return httpx.Response(200, json={"cookie": req.headers.get("cookie")})

    upstream(handler)
    await call()
    assert await call() == {"cookie": None}
