"""OpenAI 어댑터 — 네트워크 없이 실제 SDK 를 태운다 (`ai_provider=openai` 를 안 쓰면 어댑터와 같이 지운다).

SDK 의 `http_client=` 에 MockTransport 를 끼워 Chat Completions 의 실제 스트리밍 형식(SSE)을 돌려준다.
openai 3.x 는 `httpx2` 를 의존성으로 쓴다 — 테스트도 `httpx2` 로 맞춘다.
"""

import json

import httpx2
import pytest
from openai import AsyncOpenAI, AuthenticationError

from app.core.config.settings import settings
from app.module.infra.ai import Usage
from app.module.infra.ai import openai as openai_adapter


def chunk(delta: dict | None, *, finish: str | None = None, usage: dict | None = None) -> dict:
    return {
        "id": "chatcmpl-1", "object": "chat.completion.chunk", "created": 1, "model": "gpt-6-astra",
        "choices": [] if delta is None else [{"index": 0, "delta": delta, "finish_reason": finish}],
        "usage": usage,
    }


OK_BODY = "".join(
    f"data: {json.dumps(c)}\n\n"
    for c in [
        chunk({"role": "assistant", "content": ""}),
        chunk({"content": "안녕"}),
        chunk({"content": "하세요"}),
        chunk({}, finish="stop"),
        # include_usage 를 켜면 [DONE] 직전에 choices=[] + usage 청크가 온다
        chunk(None, usage={"prompt_tokens": 20, "completion_tokens": 30, "total_tokens": 50}),
    ]
).encode() + b"data: [DONE]\n\n"


@pytest.fixture
def openai_api(monkeypatch):
    monkeypatch.setattr(settings.raw, "ai_model", "")
    requests: list[httpx2.Request] = []
    reply = {"status": 200}

    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        if reply["status"] != 200:
            return httpx2.Response(reply["status"], json={"error": {
                "message": "Incorrect API key provided", "type": "invalid_request_error",
                "code": "invalid_api_key"}})
        return httpx2.Response(200, headers={"content-type": "text/event-stream"}, content=OK_BODY)

    client = AsyncOpenAI(
        api_key="test-key",
        http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)),
        max_retries=0,
    )
    monkeypatch.setattr(openai_adapter, "_client", client)
    return requests, reply


async def test_텍스트_조각만_내고_끝에_사용량을_채운다(openai_api):
    requests, _ = openai_api
    usage = Usage()
    messages = [
        {"role": "user", "content": "안녕"},
        {"role": "assistant", "content": "네"},
        {"role": "user", "content": "또"},
    ]

    stream = openai_adapter.stream(messages, system="친절하게", max_tokens=100, usage=usage)
    chunks = [c async for c in stream]

    assert chunks == ["안녕", "하세요"]  # 빈 content · finish 청크 · usage 청크는 건너뛴다
    assert usage == Usage(model="gpt-6-astra", input_tokens=20, output_tokens=30)

    sent = json.loads(requests[0].content)
    assert requests[0].url.path == "/v1/chat/completions"
    assert requests[0].headers["authorization"] == "Bearer test-key"
    assert sent["model"] == openai_adapter.DEFAULT_MODEL
    assert sent["stream"] is True
    assert sent["stream_options"] == {"include_usage": True}
    assert sent["max_completion_tokens"] == 100
    assert "max_tokens" not in sent
    assert sent["messages"] == [{"role": "system", "content": "친절하게"}, *messages]


async def test_시스템_프롬프트가_없으면_system_메시지를_넣지_않는다(openai_api):
    requests, _ = openai_api
    messages = [{"role": "user", "content": "x"}]

    _ = [c async for c in openai_adapter.stream(messages, system=None, max_tokens=10, usage=Usage())]

    assert json.loads(requests[0].content)["messages"] == messages


async def test_인증_실패는_첫_조각_전에_SDK_예외로_올라온다(openai_api):
    _, reply = openai_api
    reply["status"] = 401

    with pytest.raises(AuthenticationError):
        await anext(openai_adapter.stream([{"role": "user", "content": "x"}], system=None, max_tokens=10,
                                          usage=Usage()))


async def test_aclose는_클라이언트를_닫고_비운다(openai_api):
    await openai_adapter.aclose()
    assert openai_adapter._client is None
