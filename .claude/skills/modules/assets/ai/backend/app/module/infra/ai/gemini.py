"""Gemini (Google) 어댑터 — `ai_provider=gemini`.

공식 SDK `google-genai` 의 `client.aio.models.generate_content_stream`.
이 SDK 는 (httpx2 가 아니라) `httpx` 를 쓴다.

- 역할 이름이 다르다 — assistant 는 `"model"`
- `HttpOptions.timeout` 은 **밀리초**다. 재시도는 기본이 0회라 직접 켠다 (다른 두 SDK 는 기본 2회)
- 도구가 없어도 자동 함수 호출(AFC)이 기본으로 켜져 있어 매 요청 AFC 경로를 탄다 — 끈다
- 생각 토큰은 `thoughts_token_count` 로 따로 온다 (청구는 출력 단가). output_tokens 에 더한다
"""

from collections.abc import AsyncIterator

from google import genai
from google.genai import types

from app.core.config.settings import settings
from app.module.infra.ai import Usage

DEFAULT_MODEL = "gemini-3.8-flash"

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            api_key=settings.raw.ai_api_key,
            http_options=types.HttpOptions(
                timeout=60_000,
                retry_options=types.HttpRetryOptions(attempts=3, max_delay=10.0),
            ),
        )
    return _client


async def stream(
    messages: list[dict[str, str]], *, system: str | None, max_tokens: int, usage: Usage
) -> AsyncIterator[str]:
    model = settings.raw.ai_model or DEFAULT_MODEL
    contents = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part(text=m["content"])],
        )
        for m in messages
    ]
    config = types.GenerateContentConfig(
        system_instruction=system or None,
        max_output_tokens=max_tokens,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )

    async for chunk in await _get_client().aio.models.generate_content_stream(
        model=model, contents=contents, config=config
    ):
        meta = chunk.usage_metadata
        if meta is not None:  # 여러 청크에 올 수 있다 — 마지막 청크의 값이 요청 전체
            usage.model = chunk.model_version or model
            usage.input_tokens = meta.prompt_token_count or 0
            usage.output_tokens = (meta.candidates_token_count or 0) + (meta.thoughts_token_count or 0)
        if chunk.text:
            yield chunk.text


async def aclose() -> None:
    global _client
    if _client is not None:
        await _client.aio.aclose()
        _client.close()  # 같이 만들어지는 동기 httpx 클라이언트
        _client = None
