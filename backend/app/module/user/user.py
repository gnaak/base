from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.core.database.base import Base, now_kst


class User(Base):
    __tablename__ = "tb_users"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=True)
    name = Column(String(20), nullable=False)
    profile_image = Column(String(200), nullable=True)
    active = Column(Boolean, default=True)
    # 시간 컬럼은 전부 DateTime(timezone=True) + now_kst()로 통일한다.
    # (MySQL DATETIME은 오프셋을 저장하지 않으므로 실제로는 KST 벽시계 값이 들어간다)
    created_at = Column(DateTime(timezone=True), default=now_kst)
    last_login_at = Column(DateTime(timezone=True))
