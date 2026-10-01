# app/module/user/user_repository.py

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.base import now_kst
from app.core.utils.error_code import ErrorCode
from app.core.utils.response import fail
from app.module.user.user import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_id(self, id: int):
        result = await self.db.execute(select(User).where(User.id == id))
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str):
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create_user(self, email, nickname, hashed_password):
        user = User(
            email=email,
            name=nickname,
            password=hashed_password,
            last_login_at=now_kst()
        )

        self.db.add(user)
        await self.db.commit()

    async def update_last_login(self, user: User) -> User:
        """
        로그인 시각 갱신.

        commit 후 refresh를 꼭 해야 한다. 세션이 expire_on_commit=True라서
        commit 직후에는 user의 속성이 만료 상태인데, 그대로 두면 호출부에서
        `user.id` 같은 걸 읽는 순간 async 컨텍스트 밖 lazy load가 일어나 터진다.
        """
        user.last_login_at = now_kst()
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_or_create_oauth_user(self, email: str, name: str, picture: str) -> User:
        """OAuth 로그인 — 업체가 검증한 이메일로 계정을 찾거나 만든다.

        ⚠️ **비밀번호로 가입한 계정에는 붙지 않는다.** 이메일 가입은 이메일을 검증하지 않아서,
        공격자가 피해자 이메일로 먼저 가입해 두면 피해자가 나중에 OAuth 로 로그인했을 때
        공격자의 비밀번호가 걸린 계정에 붙는다(계정 선점).
        이메일 가입에 인증 절차를 붙이면 이 제한을 풀 수 있다.
        업체가 검증한 이메일인지는 호출부(google·kakao 서비스)가 먼저 확인한다.
        """
        result = await self.db.execute(select(User).filter(User.email == email))
        user = result.unique().scalar_one_or_none()

        if user and user.password:
            raise fail(
                "an email/password account already uses this email",
                ErrorCode.OAUTH_ACCOUNT_CONFLICT,
                409,
            )

        if user:
            user.last_login_at = now_kst()
        else:
            user = User(
                email=email,
                name=name,
                profile_image=picture,
                created_at=now_kst(),
                last_login_at=now_kst()
            )

            self.db.add(user)

        await self.db.commit()
        await self.db.refresh(user)

        return user
