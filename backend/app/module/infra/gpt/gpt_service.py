# app/module/infra/gpt/gpt_service.py

from typing import Optional

from openai import AsyncOpenAI

from app.core.config.settings import settings
from app.core.logging import get_logger
from app.module.infra.redis.redis_service import RedisService

logger = get_logger(__name__)

# 앱 전체가 공유하는 단일 OpenAI 클라이언트 (redis.py와 같은 lazy 싱글톤 — lifespan이 닫는다)
_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        # SDK 기본 timeout이 600초라 반드시 명시한다
        _client = AsyncOpenAI(api_key=settings.openai_api_key, timeout=30.0, max_retries=2)
    return _client


async def close_openai_client() -> None:
    """lifespan 종료 시 호출. 한 번도 사용하지 않았으면 아무것도 하지 않는다."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None


class GPTService:
    """OpenAI SDK 래핑용 자리. 프로젝트에서 필요한 메서드를 여기에 추가한다.

    메서드에서는 get_openai_client()를 사용할 것. 로깅 규칙:
    - 호출 전: logger.info로 모델·용도 / 호출 후: 소요시간·usage 토큰 수
    - 에러 시: logger.exception (프롬프트 원문·API 키는 로그 금지)
    """

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
