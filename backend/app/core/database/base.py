# app/core/database/base.py
from datetime import datetime

import pytz
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config.settings import DATABASE_URL

KST = pytz.timezone("Asia/Seoul")

# --- ✅ DB 엔진/세션 설정 ---
# pool_pre_ping: 커넥션 체크아웃 시 살아있는지 확인 (사후 감지)
# pool_recycle: 1시간 지난 커넥션은 선제 교체 — MySQL wait_timeout·방화벽이 끊기 전에 (사전 예방)
engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True, pool_recycle=3600)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession
)

async def get_session():
    async with SessionLocal() as session:
        yield session

def now_kst():
    return datetime.now(KST)

# --- ✅ 전역 단일 Base ---
# 모든 모델이 이 Base 하나를 상속해야 Alembic이 전부 인식한다.
Base = declarative_base()
