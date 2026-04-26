# app/module/infra/google/google_service.py

import httpx
from fastapi import HTTPException

from app.core.config.settings import settings
from app.core.utils.response import fail
from app.module.user.user_repository import UserRepository


class KakaoService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def kakao_login(self, request):
        KAKAO_TOKEN_URI = "https://kauth.kakao.com/oauth/token"
        KAKAO_USER_INFO_URI = "https://kapi.kakao.com/v2/user/me"

        body = await request.json()
        code = body.get("code")

        if not code:
            raise fail("Authorization code not provided", "AUTH_CODE_NOT_PROVIDED", 400)
        
        token_data = {
            "code": code,
            "client_id": settings.kakao_client_id,
            "redirect_uri": settings.kakao_redirect_uri,
            "grant_type": "authorization_code",
        }

        if settings.kakao_client_secret:
            token_data["client_secret"] = settings.kakao_client_secret

        async with httpx.AsyncClient() as client:
            token_resp = await client.post(KAKAO_TOKEN_URI, data=token_data)
            token_resp.raise_for_status()
        
            try:
                token_resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                # 상태 코드와 응답 본문 출력
                raise HTTPException(status_code=401, detail=f"kakao token request failed: {e.response.text}")
                
            access_token = token_resp.json().get("access_token")

            if not access_token:
                raise HTTPException(status_code=500, detail="access token missing")
            
            userinfo_resp = await client.get(
                KAKAO_USER_INFO_URI,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            userinfo_resp.raise_for_status()
            userinfo = userinfo_resp.json()

            email = userinfo["kakao_account"]["email"]
            name = userinfo["kakao_account"]["profile"]["nickname"]
            picture = userinfo["kakao_account"]["profile"].get("profile_image_url", "")
            picture = picture.replace("http://", "https://")
            
        user = await self.user_repo.get_or_create_user(email, name, picture)
        
        return user 