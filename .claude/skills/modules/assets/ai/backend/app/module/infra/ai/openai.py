"""OpenAI 어댑터 — `ai_provider=openai`.

공식 SDK `openai` 의 Chat Completions 스트리밍.
⚠️ 3.x 도 **`httpx2`** 위에 있다 (`http_client=` 는 `httpx2` 것).

- `max_completion_tokens` 를 쓴다 — `max_tokens` 는 deprecated 이고 추론 모델이 거부한다.
  추론 토큰도 여기에 들어간다
- `stream_options.include_usage` 를 켜야 usage 가 온다 — `[DONE]` 직전에 `choices=[]` 인 청크 하나로
- 파일 이름이 `openai.py` 여도 `import openai` 는 SDK 를 가리킨다 (파이썬 3 은 절대 import)
"""

from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.core.config.settings import settings
from app.module.infra.ai import Usage

DEFAULT_MODEL = "gpt-6-astra"

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        # SDK 기본 timeout 은 10분이라 명시한다. 스트리밍에서는 청크 사이 최대 대기다
        _client = AsyncOpenAI(api_key=settings.raw.ai_api_key, timeout=60.0, max_retries=2)
    return _client


async def stream(
    messages: list[dict[str, str]], *, system: str | None, max_tokens: int, usage: Usage
) -> AsyncIterator[str]:
    chat = [{"role": "system", "content": system}, *messages] if system else messages

    response = await _get_client().chat.completions.create(
        model=settings.raw.ai_model or DEFAULT_MODEL,
        messages=chat,
        max_completion_tokens=max_tokens,
        stream=True,
        stream_options={"include_usage": True},
    )
    async with response:
        async for chunk in response:
            if chunk.usage is not None:
                usage.model = chunk.model
                usage.input_tokens = chunk.usage.prompt_tokens
                usage.output_tokens = chunk.usage.completion_tokens
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


async def aclose() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
