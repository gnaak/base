"""AI 채팅 — 한도 확인 → 어댑터(module/infra/ai) 스트림 → SSE.

SSE 이벤트 (프론트 `useChatStream` 과 1:1):

    event: text   data: {"text": "..."}                                    조각마다
    event: error  data: {"message": "...", "errorCode": "AI_UNAVAILABLE"}   도중에 끊김 (HTTP 는 이미 200)
    event: done   data: {}                                                 정상 끝

**첫 조각이 오기 전의 실패**(키 없음 · 업체 인증 · 연결 · 거절)는 SSE 가 아니라 `fail()` — 평소처럼
상태코드 + JSON(`errorCode: AI_UNAVAILABLE`)으로 나간다. 그래서 응답 헤더는 첫 조각이 온 뒤에 나간다.
프롬프트·답 원문은 로그에 남기지 않는다 (14일 보관).
"""

import json
from collections.abc import AsyncGenerator, AsyncIterator
from datetime import timedelta
from types import ModuleType

from app.core.config.settings import settings
from app.core.database.base import now_kst
from app.core.logging import get_logger
from app.core.utils.error_code import ErrorCode
from app.core.utils.rate_limit import check_user_limit
from app.core.utils.response import fail
from app.module.ai.ai_schema import ChatIn
from app.module.infra.ai import Usage

logger = get_logger(__name__)

PER_MINUTE_LIMIT = 10  # 한 사용자 1분 요청 수. 하루 한도는 settings.ai_daily_limit
UNAVAILABLE_MESSAGE = "AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요."


def _event(name: str, data: dict) -> str:
    # json.dumps 가 줄바꿈을 \n 으로 이스케이프한다 — data 가 한 줄이라 SSE 프레임이 깨지지 않는다
    return f"event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _seconds_until_kst_midnight() -> int:
    now = now_kst()
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(int((midnight - now).total_seconds()), 1)


class AIService:
    def __init__(self, adapter: ModuleType):
        self.adapter = adapter

    async def chat(self, user_id: int, body: ChatIn) -> AsyncIterator[str]:
        """SSE 문자열 스트림을 돌려준다. 여기서 `fail()` 이 나면 아직 응답이 시작되지 않은 것이다."""
        if not settings.raw.ai_api_key:
            fail("AI 기능이 설정되지 않았습니다.", ErrorCode.AI_UNAVAILABLE, 503)

        await check_user_limit("ai_chat", user_id, limit=PER_MINUTE_LIMIT, window=60)
        # 하루 = KST 날짜. 키에 날짜를 넣고 자정에 만료시킨다 (Retry-After 가 자정까지 남은 초)
        await check_user_limit(
            f"ai_daily:{now_kst():%Y%m%d}",
            user_id,
            limit=settings.raw.ai_daily_limit,
            window=_seconds_until_kst_midnight(),
        )

        usage = Usage()
        chunks: AsyncGenerator[str, None] = self.adapter.stream(
            [m.model_dump() for m in body.messages],
            system=settings.raw.ai_system_prompt,
            max_tokens=settings.raw.ai_max_tokens,
            usage=usage,
        )
        try:
            first: str | None = await anext(chunks)
        except StopAsyncIteration:
            first = None  # 글자 없이 끝났다 (거절·생각만 하다 max_tokens 등) — done 만 보낸다
        except Exception:
            logger.error("AI 호출 실패 — 첫 조각 전 (user=%s)", user_id, exc_info=True)
            fail(UNAVAILABLE_MESSAGE, ErrorCode.AI_UNAVAILABLE, 502)

        return self._sse(user_id, first, chunks, usage)

    async def _sse(
        self, user_id: int, first: str | None, chunks: AsyncGenerator[str, None], usage: Usage
    ) -> AsyncIterator[str]:
        try:
            if first is not None:
                yield _event("text", {"text": first})
                async for text in chunks:
                    yield _event("text", {"text": text})
        except Exception:
            logger.error("AI 스트림 도중 실패 (user=%s)", user_id, exc_info=True)
            yield _event("error", {"message": UNAVAILABLE_MESSAGE, "errorCode": ErrorCode.AI_UNAVAILABLE})
            return
        finally:
            # 클라이언트가 끊었으면 업체 연결도 닫는다 — 생성(= 청구)이 거기서 멈춘다
            await chunks.aclose()

        logger.info(
            "AI 사용량 user=%s model=%s input=%d output=%d",
            user_id, usage.model, usage.input_tokens, usage.output_tokens,
        )
        yield _event("done", {})
