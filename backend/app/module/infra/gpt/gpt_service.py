# app/module/infra/gpt/gpt_service.py

from openai import AsyncOpenAI

from app.core.config.settings import settings
from app.module.infra.redis.redis_service import RedisService

# OpenAI 비동기 클라이언트
client = AsyncOpenAI(api_key=settings.openai_api_key)


class GPTService:
    """OpenAI SDK 래핑용 자리. 프로젝트에서 필요한 메서드를 여기에 추가한다."""

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
