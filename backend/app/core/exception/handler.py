# core/exception/handler.py
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from app.core.utils.response import BaseResponse
from app.core.logging import get_logger
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

        body = BaseResponse(
            success=False,
            message=message,
            data=None,
            errorCode=getattr(exc, "error_code", "HTTP_ERROR"),
        )

        return JSONResponse(
            status_code=exc.status_code,
            content=body.model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}")
        body = BaseResponse(
            success=False,
            message="Internal Server Error",
            data=None,
            errorCode="INTERNAL_ERROR",
        )

        return JSONResponse(
            status_code=500,
            content=body.model_dump(),
        )
