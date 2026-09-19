"""테스트 공통 픽스처.

설계 요약
---------
- DB는 **전용 MySQL**(settings.test_mysql_db)만 쓴다. 세션 시작에 create_all,
  끝에 drop_all. local/prod DB는 절대 건드리지 않는다 (아래 안전장치 참고).
- 테스트 하나당 트랜잭션 하나. 끝나면 롤백하므로 테스트끼리 데이터가 안 섞인다.
  앱 코드가 commit을 호출해도 SAVEPOINT로 잡히기 때문에 바깥 트랜잭션은 살아있다.
- Redis는 fakeredis로 갈아끼운다. 실제 Redis가 떠 있지 않아도 된다.
- 인증은 목킹하지 않는다. 진짜 JWT를 발급해 진짜 쿠키로 보낸다 —
  auth_token.py의 검증 로직을 그대로 통과시켜야 테스트에 의미가 있다.
"""
import base64
import json
from datetime import timedelta

import fakeredis.aioredis
import jwt
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config.settings import settings
from app.core.database.base import Base, get_session, now_kst
from app.module.admin.admin import Admin
from app.module.user.user import User

TEST_DB_URL = settings.test_database_url


def _assert_safe_test_db() -> None:
    """운영/개발 DB를 테스트 DB로 잡는 사고를 기동 시점에 막는다.

    이 파일은 테이블을 drop 하므로, 이름이 겹치면 실제 데이터가 날아간다.
    """
    test_db = settings.raw.test_mysql_db
    if not test_db:
        pytest.exit("test_mysql_db 가 비어 있습니다. backend/.env 를 확인하세요.", returncode=1)
    for label, name in (("local", settings.raw.local_mysql_db), ("prod", settings.raw.prod_mysql_db)):
        if name and test_db == name:
            pytest.exit(
                f"test_mysql_db 가 {label}_mysql_db 와 같습니다({test_db}). "
                "테스트는 테이블을 drop 하므로 반드시 전용 DB를 쓰세요.",
                returncode=1,
            )


_assert_safe_test_db()


# ──────────────────────────────────────────────────────────────
#  DB
# ──────────────────────────────────────────────────────────────
@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(TEST_DB_URL, echo=False, pool_pre_ping=True)
    try:
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        await eng.dispose()
        pytest.exit(
            f"테스트 DB에 연결하지 못했습니다: {e}\n"
            f"  1) MySQL이 떠 있는지\n"
            f"  2) CREATE DATABASE {settings.raw.test_mysql_db}; 를 했는지 확인하세요.",
            returncode=1,
        )
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db(engine) -> AsyncSession:
    """테스트 하나짜리 트랜잭션에 묶인 세션.

    join_transaction_mode="create_savepoint" 덕분에 앱 코드의 commit()이
    바깥 트랜잭션을 끝내지 않고 SAVEPOINT 해제로 처리된다. 그래서 테스트가
    끝난 뒤 rollback 한 번으로 전부 되돌릴 수 있다.
    """
    connection = await engine.connect()
    transaction = await connection.begin()
    maker = async_sessionmaker(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    session = maker()
    try:
        yield session
    finally:
        await session.close()
        if transaction.is_active:
            await transaction.rollback()
        await connection.close()


# ──────────────────────────────────────────────────────────────
#  App / Client
# ──────────────────────────────────────────────────────────────
@pytest.fixture
def fake_redis(monkeypatch):
    """공용 Redis 클라이언트를 fakeredis로 교체한다.

    get_redis()가 모듈 전역 _client를 lazy 생성하므로 그 자리에 심으면 된다.
    """
    import app.core.database.redis as redis_module

    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(redis_module, "_client", client)
    return client


@pytest_asyncio.fixture
async def app(db, fake_redis):
    """테스트용 FastAPI 인스턴스.

    main.py의 create_app()을 그대로 쓰되 DB 세션만 테스트 세션으로 바꾼다.
    lifespan은 타지 않으므로(ASGITransport 기본) 기동 시 DB·Redis 검증은 돌지 않는다.
    """
    from app.main import create_app

    application = create_app()

    async def _override_get_session():
        yield db

    application.dependency_overrides[get_session] = _override_get_session
    yield application
    application.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app) -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ──────────────────────────────────────────────────────────────
#  인증 — 목킹하지 않고 진짜 토큰을 만든다
# ──────────────────────────────────────────────────────────────
def make_token(user_id: int, auth_type: str = "user", *, token_type: str = "access",
               expires_in: timedelta = timedelta(hours=1), secret: str | None = None) -> str:
    """auth_token.create_jwt_token()과 같은 payload 구조로 JWT를 만든다.

    엣지 케이스를 만들 수 있도록 token_type·expires_in·secret을 열어 둔다
    (만료 토큰, refresh 토큰, 서명 불일치 토큰 등).
    """
    payload = {
        "sub": str(user_id),
        "user": auth_type,
        "type": token_type,
        "exp": now_kst() + expires_in,
    }
    return jwt.encode(payload, secret or settings.jwt_secret, algorithm="HS256")


def cookie_header(**cookies: str) -> dict[str, str]:
    """쿠키 dict를 Cookie 헤더로 만든다.

    httpx의 per-request `cookies=` 는 deprecated이고, client.cookies 에 심으면
    같은 client를 쓰는 다음 요청까지 쿠키가 남는다. 요청 단위로 정확히 통제하려고
    헤더를 직접 만든다.
    """
    return {"Cookie": "; ".join(f"{k}={v}" for k, v in cookies.items())}


def auth_header(user_id: int, auth_type: str = "user", **kwargs) -> dict[str, str]:
    """로그인 상태를 흉내내는 Cookie 헤더. 접두사는 auth_type을 따른다.

    kwargs는 make_token으로 넘어간다 (expires_in, token_type, secret).
    """
    prefix = "admin_" if auth_type == "admin" else "user_"
    info = {
        "auth_type": auth_type,
        "id": user_id,
        "user_nickname": "admin" if auth_type == "admin" else "tester",
        "created_at": None,
    }
    return cookie_header(
        **{
            f"{prefix}access_token": make_token(user_id, auth_type, **kwargs),
            f"{prefix}user_info": base64.b64encode(
                json.dumps(info, ensure_ascii=False).encode("utf-8")
            ).decode("utf-8"),
        }
    )


# ──────────────────────────────────────────────────────────────
#  데이터 팩토리
# ──────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def make_user(db):
    """테스트용 User를 만들어 커밋한다. 같은 테스트 안에서 여러 번 호출 가능."""
    created = []

    async def _make(email: str = "tester@example.com", name: str = "tester", **kwargs) -> User:
        user = User(
            email=email,
            name=name,
            password=kwargs.pop("password", "hashed-password"),
            created_at=kwargs.pop("created_at", now_kst()),
            **kwargs,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        created.append(user)
        return user

    return _make


@pytest_asyncio.fixture
async def make_admin(db):
    async def _make(email: str = "admin@example.com", **kwargs) -> Admin:
        admin = Admin(
            email=email,
            password=kwargs.pop("password", "hashed-password"),
            created_at=kwargs.pop("created_at", now_kst()),
            **kwargs,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        return admin

    return _make
