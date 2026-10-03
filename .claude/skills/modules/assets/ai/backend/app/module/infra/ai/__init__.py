"""AI 업체 어댑터 — `.env` 의 `ai_provider` 로 고른 **하나만** 불러온다.

어댑터(`claude.py` · `openai.py` · `gemini.py`)는 서로 모르고 각자 자기 SDK 만 import 한다.
여기서는 이름으로만 찾으므로(`importlib`) 안 쓰는 어댑터는 파일째 지워도 된다. 어댑터가 갖출 것:

    DEFAULT_MODEL: str                       # ai_model 이 비었을 때
    async def stream(messages, *, system, max_tokens, usage) -> AsyncIterator[str]
    async def aclose() -> None               # lifespan 종료 때 (클라이언트를 만든 적 없으면 아무것도 안 함)

- `messages` 는 `[{"role": "user" | "assistant", "content": str}]` — 업체 형식으로 바꾸는 건 어댑터 몫
- 텍스트 조각만 yield 하고, 스트림을 끝까지 읽으면 `usage` 를 채운다 (중간에 끊기면 못 채울 수 있다)
- SDK 예외는 그대로 올린다 — 첫 조각 전이면 서비스가 502 `fail()`, 도중이면 SSE `error` 이벤트로 바꾼다
- SDK 클라이언트는 처음 쓸 때 한 번 만들고(커넥션 풀 재사용) `aclose()` 가 닫는다
"""

import importlib
import sys
from dataclasses import dataclass
from types import ModuleType

from app.core.config.settings import settings


@dataclass
class Usage:
    """스트림 하나의 사용량. 어댑터가 끝에 채우고 서비스가 `logs/ai.log` 에 남긴다.

    output_tokens 는 생각(추론) 토큰을 포함한다 — 업체가 그만큼 청구한다.
    """

    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0


def get_adapter() -> ModuleType:
    """선택된 어댑터 모듈. SDK import 비용은 첫 요청이 낸다 (기동은 SDK 를 불러오지 않는다)."""
    return importlib.import_module(f"{__name__}.{settings.raw.ai_provider}")


async def close_ai_client() -> None:
    """lifespan 종료 시 호출. 어댑터를 한 번도 불러오지 않았으면 아무것도 하지 않는다."""
    adapter = sys.modules.get(f"{__name__}.{settings.raw.ai_provider}")
    if adapter is not None:
        await adapter.aclose()
