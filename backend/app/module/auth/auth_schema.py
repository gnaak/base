"""auth 도메인의 요청 스키마.

도메인마다 `[domain]_schema.py` 하나를 두고 요청 바디를 여기에 모은다.
라우터가 이 타입을 파라미터로 받으면 FastAPI가 검증까지 끝내준다 —
예전처럼 `body = await request.json()` 후 `body.get(...)` 할 필요가 없다.

이메일 형식까지 검증하고 싶으면 `email-validator` 를 설치하고
`email: EmailStr` 로 바꾸면 된다 (기본 의존성을 늘리지 않으려고 str로 뒀다).
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    """이메일/비밀번호 로그인. `type` 으로 user/admin 세션을 고른다."""

    email: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1)
    type: Literal["user", "admin"] = "user"


class SignupIn(BaseModel):
    email: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1)
    nickname: str = Field(min_length=1, max_length=20)


class OAuthCodeIn(BaseModel):
    """OAuth 콜백이 넘겨주는 authorization code."""

    code: str = Field(min_length=1)


class SessionOut(BaseModel):
    """로그인·refresh 응답의 `data`.

    `{p}user_info` 쿠키에 base64로 담기는 내용과 **같은 객체**다
    (`auth_token.create_jwt_token()`이 이걸 만들어 쿠키에 싣고 그대로 반환한다).
    프론트 `types/user.ts`의 `UserInfo`와 1:1이므로, 여기에 필드를 추가하면
    거기도 같이 고칠 것.

    user와 admin 둘 다 담을 수 있어야 하므로 공통 필드만 갖는다
    (`tb_admins`에는 name·profile_image 컬럼이 없다).
    """

    auth_type: str
    id: int
    user_nickname: str
    created_at: datetime | None = None
