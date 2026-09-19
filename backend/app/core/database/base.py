# app/core/database/base.py
from datetime import datetime

import pytz
from sqlalchemy import Column, DateTime
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


class TimestampMixin:
    """생성·수정·삭제 시각. 새 모델은 기본적으로 이걸 같이 상속한다.

        class Order(Base, TimestampMixin):
            __tablename__ = "tb_orders"
            id = Column(Integer, primary_key=True)

    - `updated_at`은 `onupdate`라 **ORM으로 수정할 때만** 갱신된다.
      `session.execute(update(...))` 같은 bulk update에는 안 걸리므로,
      그때는 `values(updated_at=now_kst())`를 직접 넣을 것
    - `deleted_at`은 soft delete 표시다. **자동으로 걸러주지 않는다** —
      조회 쪽에서 `.where(Model.deleted_at.is_(None))`을 넣어야 한다
      (전역 필터는 통계·복구처럼 지운 것까지 봐야 하는 쿼리를 막아서 두지 않았다)
    - 시간은 전부 `DateTime(timezone=True)` + `now_kst()`로 통일
      (MySQL DATETIME은 오프셋을 저장하지 않으므로 실제로는 KST 벽시계 값)
    """

    created_at = Column(DateTime(timezone=True), default=now_kst, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=now_kst, onupdate=now_kst, nullable=False
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
