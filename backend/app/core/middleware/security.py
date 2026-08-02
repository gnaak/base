from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config.settings import settings


# 이름 축소: Security
class Security(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        h = response.headers
        h["X-Content-Type-Options"] = "nosniff"
        h["X-Frame-Options"] = "DENY"
        h["X-XSS-Protection"] = "1; mode=block"

        # HSTS는 prod에서만. local(http)에 붙이면 브라우저가 해당 호스트를
        # 1년간 https로 강제 리다이렉트하도록 기억해버린다.
        if settings.env == "prod":
            h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


# 함수명 축소: setup_security 또는 add_security
def setup_security(app: FastAPI):
    app.add_middleware(Security)
