# app/module/infra/kakao/kakao_service.py

from app.core.config.settings import settings
from app.core.logging import get_logger
from app.core.utils.http_client import request_json
from app.core.utils.response import fail
from app.module.user.user_repository import UserRepository

logger = get_logger(__name__)


class KakaoService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def kakao_login(self, code: str):
        """`code` 의 존재 여부는 OAuthCodeIn 스키마가 이미 보장한다."""
        KAKAO_TOKEN_URI = "https://kauth.kakao.com/oauth/token"
        KAKAO_USER_INFO_URI = "https://kapi.kakao.com/v2/user/me"

        token_data = {
            "code": code,
            "client_id": settings.kakao_client_id,
            "redirect_uri": settings.kakao_redirect_uri,
            "grant_type": "authorization_code",
        }

        if settings.kakao_client_secret:
            token_data["client_secret"] = settings.kakao_client_secret

        token = await request_json(
            "POST",
            KAKAO_TOKEN_URI,
            data=token_data,
            context="kakao token",
            error_code="OAUTH_TOKEN_FAILED",
            fail_status=401,
        )

        access_token = token.get("access_token")
        if not access_token:
            logger.warning("kakao token response missing access_token")
            raise fail("kakao access token missing", "OAUTH_TOKEN_MISSING", 502)

        userinfo = await request_json(
            "GET",
            KAKAO_USER_INFO_URI,
            headers={"Authorization": f"Bearer {access_token}"},
            context="kakao userinfo",
            error_code="OAUTH_USERINFO_FAILED",
            fail_status=502,
        )

        # email·nickname은 동의항목을 체크해야만 내려온다 — 없으면 KeyError 500이 아니라 명확한 에러로
        kakao_account = userinfo.get("kakao_account") or {}
        profile = kakao_account.get("profile") or {}

        email = kakao_account.get("email")
        if not email:
            raise fail("kakao email consent required", "OAUTH_EMAIL_REQUIRED", 400)

        name = profile.get("nickname") or ""
        picture = (profile.get("profile_image_url") or "").replace("http://", "https://")

        user = await self.user_repo.get_or_create_user(email, name, picture)

        return user
