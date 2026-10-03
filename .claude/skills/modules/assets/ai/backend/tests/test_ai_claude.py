"""Claude 어댑터 — 네트워크 없이 실제 SDK 를 태운다 (`ai_provider=claude` 를 안 쓰면 어댑터와 같이 지운다).

SDK 의 `http_client=` 에 MockTransport 를 끼워 Anthropic 의 실제 스트리밍 형식(SSE)을 돌려준다.
⚠️ anthropic 1.x 는 `httpx2` 위에 있다 — `httpx.MockTransport` 를 넣으면 거부된다.
"""

import json
import logging

import httpx2
import pytest
from anthropic import AsyncAnthropic, AuthenticationError

from app.core.config.settings import settings
from app.module.infra.ai import Usage, claude
from tests.conftest import auth_header
from tests.test_ai_router import HELLO, URL, parse_sse


def sse(*events: tuple[str, dict]) -> bytes:
    return "".join(f"event: {name}\ndata: {json.dumps(data)}\n\n" for name, data in events).encode()


MESSAGE_START = ("message_start", {
    "type": "message_start",
    "message": {
        "id": "msg_01", "type": "message", "role": "assistant", "model": "claude-opus-5-5",
        "content": [], "stop_reason": None, "stop_sequence": None,
        "usage": {"input_tokens": 25, "output_tokens": 1},
    },
})


def text_delta(index: int, text: str) -> tuple[str, dict]:
    return ("content_block_delta", {
        "type": "content_block_delta", "index": index, "delta": {"type": "text_delta", "text": text},
    })


# 생각이 항상 켜진 모델(Opus 5.5)의 실제 순서 — 생각 블록(표시 생략) 뒤에 텍스트 블록
OK_BODY = sse(
    MESSAGE_START,
    ("content_block_start", {"type": "content_block_start", "index": 0,
                             "content_block": {"type": "thinking", "thinking": "", "signature": ""}}),
    ("content_block_delta", {"type": "content_block_delta", "index": 0,
                             "delta": {"type": "signature_delta", "signature": "sig"}}),
    ("content_block_stop", {"type": "content_block_stop", "index": 0}),
    ("content_block_start", {"type": "content_block_start", "index": 1,
                             "content_block": {"type": "text", "text": ""}}),
    ("ping", {"type": "ping"}),
    text_delta(1, "안녕"),
    text_delta(1, "하세요"),
    ("content_block_stop", {"type": "content_block_stop", "index": 1}),
    ("message_delta", {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None},
                       "usage": {"output_tokens": 42}}),
    ("message_stop", {"type": "message_stop"}),
)

MID_STREAM_ERROR_BODY = sse(
    MESSAGE_START,
    ("content_block_start", {"type": "content_block_start", "index": 0,
                             "content_block": {"type": "text", "text": ""}}),
    text_delta(0, "안녕"),
    ("error", {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}),
)


@pytest.fixture
def anthropic_api(monkeypatch):
    """claude 어댑터의 클라이언트를 MockTransport 를 낀 것으로 바꾼다. 받은 요청을 돌려준다."""
    monkeypatch.setattr(settings.raw, "ai_provider", "claude")
    monkeypatch.setattr(settings.raw, "ai_api_key", "test-key")
    monkeypatch.setattr(settings.raw, "ai_model", "")
    requests: list[httpx2.Request] = []
    reply = {"status": 200, "body": OK_BODY}

    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        if reply["status"] != 200:
            return httpx2.Response(reply["status"], json=reply["body"])
        return httpx2.Response(200, headers={"content-type": "text/event-stream"}, content=reply["body"])

    client = AsyncAnthropic(
        api_key="test-key",
        http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)),
        max_retries=0,
    )
    monkeypatch.setattr(claude, "_client", client)
    return requests, reply


async def test_텍스트_조각만_내고_끝에_사용량을_채운다(anthropic_api):
    requests, _ = anthropic_api
    usage = Usage()

    chunks = [
        c async for c in claude.stream(
            [{"role": "user", "content": "안녕"}], system="친절하게", max_tokens=100, usage=usage
        )
    ]

    assert chunks == ["안녕", "하세요"]  # 생각 블록 · ping 은 나오지 않는다
    assert usage == Usage(model="claude-opus-5-5", input_tokens=25, output_tokens=42)

    sent = json.loads(requests[0].content)
    assert requests[0].url.path == "/v1/messages"
    assert requests[0].headers["x-api-key"] == "test-key"
    assert sent["model"] == claude.DEFAULT_MODEL
    assert sent["stream"] is True
    assert sent["max_tokens"] == 100
    assert sent["system"] == "친절하게"
    assert sent["messages"] == [{"role": "user", "content": "안녕"}]


async def test_시스템_프롬프트가_없으면_보내지_않는다(anthropic_api, monkeypatch):
    requests, _ = anthropic_api
    monkeypatch.setattr(settings.raw, "ai_model", "claude-sonnet-5")

    _ = [c async for c in claude.stream([{"role": "user", "content": "x"}], system="", max_tokens=10,
                                        usage=Usage())]

    sent = json.loads(requests[0].content)
    assert "system" not in sent
    assert sent["model"] == "claude-sonnet-5"  # ai_model 이 있으면 그것


async def test_인증_실패는_첫_조각_전에_SDK_예외로_올라온다(anthropic_api):
    _, reply = anthropic_api
    reply.update(status=401, body={"type": "error",
                                   "error": {"type": "authentication_error", "message": "invalid x-api-key"}})

    with pytest.raises(AuthenticationError):
        await anext(claude.stream([{"role": "user", "content": "x"}], system=None, max_tokens=10,
                                  usage=Usage()))


async def test_aclose는_클라이언트를_닫고_비운다(anthropic_api):
    await claude.aclose()
    assert claude._client is None
    await claude.aclose()  # 두 번 불러도 된다


# ── 라우터까지 — 실제 SDK 스트림이 SSE 로 ─────────────────────
async def test_라우터를_거쳐_SSE와_사용량_로그가_나온다(client, anthropic_api, caplog):
    with caplog.at_level(logging.INFO, logger="app.module.ai"):
        res = await client.post(URL, json=HELLO, headers=auth_header(3))

    assert res.status_code == 200
    assert parse_sse(res.text) == [("text", {"text": "안녕"}), ("text", {"text": "하세요"}), ("done", {})]
    assert "AI 사용량 user=3 model=claude-opus-5-5 input=25 output=42" in caplog.text


async def test_라우터_업체_인증_실패는_502_JSON(client, anthropic_api):
    _, reply = anthropic_api
    reply.update(status=401, body={"type": "error",
                                   "error": {"type": "authentication_error", "message": "invalid x-api-key"}})

    res = await client.post(URL, json=HELLO, headers=auth_header(3))

    assert res.status_code == 502
    assert res.json()["errorCode"] == "AI_UNAVAILABLE"


async def test_라우터_스트림_도중_overloaded는_error_이벤트(client, anthropic_api):
    _, reply = anthropic_api
    reply["body"] = MID_STREAM_ERROR_BODY

    res = await client.post(URL, json=HELLO, headers=auth_header(3))

    assert res.status_code == 200
    events = parse_sse(res.text)
    assert events[0] == ("text", {"text": "안녕"})
    assert events[-1][0] == "error"
    assert events[-1][1]["errorCode"] == "AI_UNAVAILABLE"
