from fastapi import APIRouter

from app.core.provider.http.deps import UserProvider
from app.core.utils.response import BaseResponse, success
from app.module.user.user_schema import UserOut

router = APIRouter()


@router.get("/me", response_model=BaseResponse[UserOut])
async def get_me(p: UserProvider):
    return success(await p.user_service.get_me(p.auth.user_id))
