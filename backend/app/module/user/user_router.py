from fastapi import APIRouter

from app.core.provider.http.deps import UserProvider
from app.core.utils.response import success

router = APIRouter()


@router.get("/me")
async def get_me(p: UserProvider):
    return success(await p.user_service.get_me(p.auth.user_id))
