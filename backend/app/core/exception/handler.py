# core/exception/handler.py
import logging

from fastapi import FastAPI, Request, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.core.config.settings import settings
from app.core.logging import get_logger
from app.core.logging.context import get_request_id
from app.core.utils.response import BaseResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = get_logger(__name__)


def setup_exceptions(app: FastAPI) -> None:
    """
    모든 예외 핸들러를 등록하는 함수
    """
    @app.exception_handler(StarletteHTTPException)
    @app.exception_handler(HTTPException)
    async def http_handler(request: Request, exc: HTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "HTTP Error"
        error_code = getattr(exc, "error_code", None) or "HTTP_ERROR"

        # 실패 사유(message·errorCode)를 로그에 남긴다 — 액세스 로그의 상태코드만으로는 원인 추적이 안 된다.
        # 4xx는 INFO(401 폭주가 경고 폭주가 되지 않게), 5xx만 WARNING.
        level = logging.WARNING if exc.status_code >= 500 else logging.INFO
        logger.log(
            level,
            "%s %s -> %d: %s [%s]",
            request.method, request.url.path, exc.status_code, message, error_code,
        )

        body = BaseResponse(
            success=False,
            message=message,
            data=None,
            errorCode=error_code,
        )

        return JSONResponse(
            status_code=exc.status_code,
            content=jsonable_encoder(body),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        """요청 스키마 검증 실패 → BaseResponse 형태로 변환.

        이 핸들러가 없으면 FastAPI 기본 핸들러가 `{"detail": [...]}` 를 내보내서
        프론트의 BaseResponse 계약이 깨진다 (`json.success` 가 undefined가 되고
        useAPI는 "Something went wrong" 만 띄운다).
        """
        errors = exc.errors()
        first = errors[0] if errors else {}
        # loc 는 ("body", "email") 같은 형태 — 앞의 위치 구분자를 떼고 필드명만 남긴다
        field = ".".join(str(x) for x in first.get("loc", [])[1:])
        message = first.get("msg", "입력값이 올바르지 않습니다")

        logger.info(
            "%s %s -> 422: %s [%s]",
            request.method, request.url.path, f"{field}: {message}" if field else message,
            "VALIDATION_ERROR",
        )

        body = BaseResponse(
            success=False,
            message=f"{field}: {message}" if field else message,
            data=None,
            errorCode="VALIDATION_ERROR",
        )

        return JSONResponse(status_code=422, content=jsonable_encoder(body))

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        # exc_info로 traceback까지 남긴다 — 한 줄 메시지만으로는 디버깅 불가
        logger.error(
            "Unhandled exception: %s %s", request.method, request.url.path, exc_info=exc
        )

        # 이 응답은 ServerErrorMiddleware(최외곽)가 보내므로 RequestIdMiddleware·CORSMiddleware를
        # 거치지 않는다 — request_id와 CORS 헤더를 직접 붙인다 (없으면 브라우저에선 CORS 오류로 보인다)
        headers = {"x-request-id": get_request_id()}
        origin = request.headers.get("origin")
        if origin and origin in settings.cors_origins:
            headers["access-control-allow-origin"] = origin
            headers["access-control-allow-credentials"] = "true"

        body = BaseResponse(
            success=False,
            message="Internal Server Error",
            data=None,
            errorCode="INTERNAL_ERROR",
        )

        return JSONResponse(
            status_code=500,
            content=jsonable_encoder(body),
            headers=headers,
        )
