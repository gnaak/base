# app/core/database/redis.py

import redis.asyncio as redis

from app.core.config.settings import settings

# 앱 전체가 공유하는 단일 Redis 클라이언트.
# import 시점이 아니라 첫 사용 시점에 만든다 (테스트·alembic에서 불필요한 연결을 만들지 않기 위해).
_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None and settings.redis_in_memory:
        _client = _memory_client()
    if _client is None:
        _client = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password or None,
            db=settings.raw.redis_db,
            # RESP2 로 고정한다. redis-py 8 은 기본이 RESP3 라 연결할 때 HELLO 를 보내는데,
            # Windows 개발 PC 에 흔한 옛 Redis(3.x)는 HELLO 를 몰라서 아예 붙지 못한다.
            # 앱은 RESP3 기능을 쓰지 않고, 테스트의 fakeredis 와도 응답 형태가 같아진다
            protocol=2,
            decode_responses=True,
            health_check_interval=30,  # idle 후 첫 명령 전에 ping으로 연결 확인
            socket_keepalive=True,     # 방화벽/NAT의 idle 컷 방어
        )
    return _client


def _memory_client() -> redis.Redis:
    """`local_redis_host=memory` — Redis 를 설치하지 않은 로컬 PC 용. 이 프로세스 메모리에만 있다.

    재시작하면 비워진다 (레이트리밋 카운터 · 끊은 세션 목록 · 세션 버전). 대개 로그인은 그대로다 —
    버전을 올린 적 있는 계정(비번 변경 등)만 다음 refresh 에서 다시 로그인하게 된다 (`ver` 불일치).
    운영은 settings 가 거부하고, fakeredis 는 dev 의존성이라 운영 설치(--no-dev)에는 아예 없다.
    """
    import fakeredis.aioredis  # dev 의존성 — 메모리 모드에서만 불러온다

    return fakeredis.aioredis.FakeRedis(decode_responses=True)


async def close_redis() -> None:
    """lifespan 종료 시 호출. 한 번도 연결하지 않았으면 아무것도 하지 않는다."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
