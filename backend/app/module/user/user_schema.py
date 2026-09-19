"""user 도메인의 응답 스키마.

응답 스키마를 두는 이유는 문서화만이 아니다. 라우터에 `response_model`로 걸면
FastAPI가 **스키마에 없는 필드를 잘라낸다.** 서비스가 실수로 모델을 통째로
반환해도 `password`가 나갈 수 없다 — 예전에는 그걸 사람이 손으로 골라 담아
막고 있었다.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    """`GET /api/user/me` 응답. 프론트 `types/user.ts`의 `UserDetail`과 1:1."""

    # SQLAlchemy 모델을 그대로 넘길 수 있게 한다 (UserOut.model_validate(user))
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    profile_image: str | None = None
    created_at: datetime | None = None
