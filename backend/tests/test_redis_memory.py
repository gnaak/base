"""local_redis_host=memory — Redis 를 설치하지 않은 로컬 PC 용 메모리 Redis.

로컬에서는 진짜 Redis 와 같은 코드 경로(레이트리밋 · 세션 무효화)를 타고, 운영에서는 켜질 수 없어야 한다.
"""

import fakeredis.aioredis
import pytest

import app.core.database.redis as redis_module
from app.core.config.settings import Settings, settings


@pytest.fixture
def memory(monkeypatch):
    monkeypatch.setattr(settings.raw, "local_redis_host", "memory")
    monkeypatch.setattr(redis_module, "_client", None)  # 다음 get_redis() 가 새로 만든다


async def test_memory면_설치된_Redis_없이_메모리_클라이언트를_쓴다(memory):
    client = redis_module.get_redis()

    assert isinstance(client, fakeredis.aioredis.FakeRedis)
    assert await client.ping()
    await client.incr("k")
    assert await client.get("k") == "1"  # decode_responses — 진짜 클라이언트와 같은 str
    await redis_module.close_redis()


async def test_대소문자와_공백은_가리지_않는다(monkeypatch):
    monkeypatch.setattr(settings.raw, "local_redis_host", " Memory ")
    monkeypatch.setattr(redis_module, "_client", None)

    assert isinstance(redis_module.get_redis(), fakeredis.aioredis.FakeRedis)
    await redis_module.close_redis()


def test_기동_로그에_메모리라고_적힌다(memory):
    assert "redis=memory(로컬 전용" in settings.describe()


def test_운영에서_memory면_기동을_거부한다(monkeypatch):
    """재시작하면 끊은 세션이 되살아난다 — 운영에서 켜지면 안 된다."""
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("PROD_REDIS_HOST", "memory")

    with pytest.raises(RuntimeError, match="로컬 전용"):
        Settings()


def test_로컬에서_memory여도_운영_값은_건드리지_않는다(monkeypatch):
    """local 만 memory 로 적어 둔 .env 를 그대로 운영에 써도 운영은 prod_redis_host 를 본다."""
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("LOCAL_REDIS_HOST", "memory")
    monkeypatch.setenv("PROD_REDIS_HOST", "10.0.0.5")

    prod = Settings()

    assert prod.redis_in_memory is False
    assert prod.redis_host == "10.0.0.5"
