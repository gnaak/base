"""Gemini 어댑터 — 네트워크 없이 실제 SDK 를 태운다 (`ai_provider=gemini` 를 안 쓰면 어댑터와 같이 지운다).

google-genai 는 (httpx2 가 아니라) `httpx` 를 쓰고, `HttpOptions(async_client_args={"transport": ...})` 로
트랜스포트를 끼울 수 있다. `streamGenerateContent?alt=sse` 의 실제 형식(SSE)을 돌려준다.
"""

import json
import logging

import httpx
import pytest
from google import genai
from google.genai import errors, types

from app.core.config.settings import settings
from app.module.infra.ai import Usage, gemini


def sse(*chunks: dict) -> bytes:
    return "".join(f"data: {json.dumps(c, ensure_ascii=False)}\r\n\r\n" for c in chunks).encode()


OK_BODY = sse(
    {
        "candidates": [{"content": {"role": "model", "parts": [
            {"text": "질문을 정리하면…", "thought": True},  # 생각 요약 — 사용자에게 내보내지 않는다
            {"text": "안녕"},
        ]}, "index": 0}],
        "usageMetadata": {"promptTokenCount": 10, "totalTokenCount": 10},
        "modelVersion": "gemini-3.8-flash",
        "responseId": "r1",
    },
    {
        "candidates": [{"content": {"role": "model", "parts": [{"text": "하세요"}]},
                        "finishReason": "STOP", "index": 0}],
        "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5, "thoughtsTokenCount": 7,
                          "totalTokenCount": 22},
        "modelVersion": "gemini-3.8-flash",
        "responseId": "r1",
    },
)


@pytest.fixture
async def gemini_api(monkeypatch):
    monkeypatch.setattr(settings.raw, "ai_model", "")
    requests: list[httpx.Request] = []
    reply = {"status": 200}

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if reply["status"] != 200:
            return httpx.Response(reply["status"], json={"error": {
                "code": 400, "message": "API key not valid. Please pass a valid API key.",
                "status": "INVALID_ARGUMENT"}})
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=OK_BODY)

    client = genai.Client(
        api_key="test-key",
        http_options=types.HttpOptions(async_client_args={"transport": httpx.MockTransport(handler)}),
    )
    monkeypatch.setattr(gemini, "_client", client)
    yield requests, reply
    await client.aio.aclose()
    client.close()


async def test_텍스트_조각만_내고_끝에_사용량을_채운다(gemini_api, caplog):
    requests, _ = gemini_api
    usage = Usage()
    messages = [
        {"role": "user", "content": "안녕"},
        {"role": "assistant", "content": "네"},
        {"role": "user", "content": "또"},
    ]

    with caplog.at_level(logging.INFO):
        chunks = [c async for c in gemini.stream(messages, system="친절하게", max_tokens=100, usage=usage)]

    assert chunks == ["안녕", "하세요"]  # thought 파트는 chunk.text 에서 빠진다
    # 생각 토큰(thoughtsTokenCount)은 따로 오므로 출력에 더한다 — 5 + 7
    assert usage == Usage(model="gemini-3.8-flash", input_tokens=10, output_tokens=12)

    req = requests[0]
    assert req.url.path == f"/v1beta/models/{gemini.DEFAULT_MODEL}:streamGenerateContent"
    assert req.url.params["alt"] == "sse"
    assert req.headers["x-goog-api-key"] == "test-key"
    sent = json.loads(req.content)
    assert sent["contents"] == [
        {"role": "user", "parts": [{"text": "안녕"}]},
        {"role": "model", "parts": [{"text": "네"}]},  # assistant → model
        {"role": "user", "parts": [{"text": "또"}]},
    ]
    assert sent["systemInstruction"]["parts"] == [{"text": "친절하게"}]
    assert sent["generationConfig"]["maxOutputTokens"] == 100
    # 도구가 없어도 AFC 가 기본으로 켜진다 — 끈 것이 먹었는지 (켜져 있으면 이 로그가 남는다)
    assert "AFC is enabled" not in caplog.text


async def test_시스템_프롬프트가_없으면_보내지_않는다(gemini_api):
    requests, _ = gemini_api

    _ = [c async for c in gemini.stream([{"role": "user", "content": "x"}], system="", max_tokens=10,
                                        usage=Usage())]

    assert "systemInstruction" not in json.loads(requests[0].content)


async def test_키가_틀리면_첫_조각_전에_SDK_예외로_올라온다(gemini_api):
    _, reply = gemini_api
    reply["status"] = 400

    with pytest.raises(errors.ClientError):
        await anext(gemini.stream([{"role": "user", "content": "x"}], system=None, max_tokens=10,
                                  usage=Usage()))


async def test_aclose는_클라이언트를_비운다(gemini_api):
    await gemini.aclose()
    assert gemini._client is None
