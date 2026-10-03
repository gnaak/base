"""Claude (Anthropic) 어댑터 — `ai_provider=claude`.

공식 SDK `anthropic`. ⚠️ 1.x 는 `httpx` 가 아니라 **`httpx2`** 위에 있다 — `http_client=` 로 넘기는
클라이언트·트랜스포트도 `httpx2` 것이어야 한다 (`httpx` 것을 넘기면 거부된다).

Claude Opus 5.5 는 생각이 항상 켜져 있다 — 생각 토큰도 `max_tokens` 에 들어가고(`ai_max_tokens`),
첫 글자가 나오기까지 몇 초 걸릴 수 있다. 생각 블록은 `text_stream` 에 나오지 않는다.
"""

from collections.abc import AsyncIterator

from anthropic import AsyncAnthropic

from app.core.config.settings import settings
from app.module.infra.ai import Usage

DEFAULT_MODEL = "claude-opus-5-5"

_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        # SDK 기본 timeout 은 10분이라 명시한다. 스트리밍에서는 청크 사이 최대 대기다.
        # max_retries 는 연결 실패·429·5xx 를 첫 응답 전에만 다시 보낸다 (스트림 도중은 아니다)
        _client = AsyncAnthropic(api_key=settings.raw.ai_api_key, timeout=60.0, max_retries=2)
    return _client


async def stream(
    messages: list[dict[str, str]], *, system: str | None, max_tokens: int, usage: Usage
) -> AsyncIterator[str]:
    params: dict = {
        "model": settings.raw.ai_model or DEFAULT_MODEL,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        params["system"] = system

    async with _get_client().messages.stream(**params) as s:
        async for text in s.text_stream:
            yield text
        final = await s.get_final_message()

    usage.model = final.model
    usage.input_tokens = final.usage.input_tokens
    usage.output_tokens = final.usage.output_tokens


async def aclose() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
