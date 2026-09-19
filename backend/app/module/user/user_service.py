# app/module/user/user_service.py
from app.core.utils.response import fail
from app.module.user.user_repository import UserRepository
from app.module.user.user_schema import UserOut


class UserService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def get_user_by_id(self, user_id: int):
        return await self.user_repo.get_user_by_id(user_id)

    async def get_me(self, user_id: int) -> UserOut:
        """
        내 정보.

        `UserOut`에 선언된 필드만 나간다 — 모델을 통째로 넘겨도 `password`는
        스키마에 없으므로 잘려 나간다. 예전에는 dict를 손으로 골라 담아
        이걸 막았는데, 이제는 타입이 막는다.
        """
        user = await self.user_repo.get_user_by_id(user_id)
        if not user:
            fail("user not found", "USER_NOT_FOUND", 404)

        return UserOut.model_validate(user)
