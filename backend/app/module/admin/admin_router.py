from fastapi import APIRouter

# 관리자 전용 라우트를 여기에 채운다. 로그인 강제는 파라미터 타입 하나로 끝난다:
#
#   from app.core.provider.http.deps import AdminProvider
#   from app.core.utils.response import success
#
#   @router.get("/users/{user_id}")
#   async def get_user(user_id: int, p: AdminProvider):
#       return success(await p.user_service.get_user_by_id(user_id))

router = APIRouter()
