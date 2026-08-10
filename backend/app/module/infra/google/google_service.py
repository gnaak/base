# app/module/infra/google/google_service.py

from app.core.config.settings import settings
from app.core.logging import get_logger
from app.core.utils.http_client import request_json
from app.core.utils.response import fail
from app.module.user.user_repository import UserRepository

logger = get_logger(__name__)


class GoogleService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def google_login(self, request):
        GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
        GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

        body = await request.json()
        code = body.get("code")

        if not code:
            raise fail("Authorization code not provided", "AUTH_CODE_NOT_PROVIDED", 400)

        token = await request_json(
            "POST",
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
            context="google token",
            error_code="OAUTH_TOKEN_FAILED",
            fail_status=401,
        )

        access_token = token.get("access_token")
        if not access_token:
            logger.warning("google token response missing access_token")
            raise fail("google access token missing", "OAUTH_TOKEN_MISSING", 502)

        userinfo = await request_json(
            "GET",
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            context="google userinfo",
            error_code="OAUTH_USERINFO_FAILED",
            fail_status=502,
        )

        email = userinfo.get("email")
        if not email:
            # email 없이 유저를 만들면 email=NULL 행끼리 서로 매칭되는 사고가 난다
            raise fail("google account has no email", "OAUTH_EMAIL_REQUIRED", 400)

        name = userinfo.get("name") or ""
        picture = userinfo.get("picture", "")

        user = await self.user_repo.get_or_create_user(email, name, picture)

        return user
