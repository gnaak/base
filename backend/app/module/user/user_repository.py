# app/module/user/user_repository.py

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.base import now_kst
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

    async def get_or_create_user(self, email: str, name: str, picture: str) -> User | None:
        result = await self.db.execute(select(User).filter(User.email == email))
        user = result.unique().scalar_one_or_none()

        if user:
            user.last_login_at=now_kst()
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
