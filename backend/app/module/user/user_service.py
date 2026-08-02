# app/module/user/user_service.py
from app.core.utils.response import fail
from app.module.user.user_repository import UserRepository


class UserService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def get_user_by_id(self, user_id: int):
        return await self.user_repo.get_user_by_id(user_id)

    async def get_me(self, request):
        """
        내 정보. 응답에 내보낼 필드를 **명시적으로** 골라서 dict로 만든다.

        ⚠️ 모델 객체를 그대로 반환하지 말 것.
        FastAPI는 SQLAlchemy 모델도 직렬화해주기 때문에(내부의 `_sa_*` 키만 걸러낸다)
        에러 없이 200이 나가지만, `password` 해시까지 통째로 응답에 실린다.
        """
        user = await self.user_repo.get_user_by_id(request.user_id)
        if not user:
            fail("user not found", "USER_NOT_FOUND", 404)

        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "profile_image": user.profile_image,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }