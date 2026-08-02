# app/core/database/redis.py
from typing import Optional

import redis.asyncio as redis

from app.core.config.settings import settings

# 앱 전체가 공유하는 단일 Redis 클라이언트.
# import 시점이 아니라 첫 사용 시점에 만든다 (테스트·alembic에서 불필요한 연결을 만들지 않기 위해).
_client: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password or None,
            db=0,
            decode_responses=True,
        )
    return _client


async def close_redis() -> None:
    """lifespan 종료 시 호출. 한 번도 연결하지 않았으면 아무것도 하지 않는다."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
