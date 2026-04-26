import os

import redis.asyncio as redis

from app.core.config.settings import settings

SESSION_TTL = int(os.getenv("SESSION_TTL", "3600"))

redis_client = redis.Redis(
    host=settings.redis_host,
    port=settings.redis_port,
    password=settings.redis_password or None,
    db=0,
    decode_responses=True,
)
