# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config.settings import settings
from app.core.database.redis import close_redis
from app.core.middleware.register import setup_middlewares
from app.core.exception.handler import setup_exceptions
from app.core.logging import setup_logging, get_logger
from app.module import *

# 로깅 설정
setup_logging()
logger = get_logger(__name__)

# 1. Lifespan 설정: 서버 시작과 종료 시 실행될 로직
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Backend 시작 중...")

    # 어떤 환경으로 인식했는지 반드시 남긴다.
    # env를 잘못 잡으면 쿠키 속성이 통째로 달라져서 "로그인은 200인데 세션이 안 잡히는" 증상이 난다.
    logger.info("설정: %s", settings.describe())
    for warning in settings.config_warnings():
        logger.warning("⚠️  %s", warning)

    yield

    logger.info("🛑 Backend 종료 중...")
    await close_redis()
    # 예: await ws_manager.close_all()


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    
    # 1. 예외 핸들러 등록 (가장 먼저 혹은 미들웨어 직후에 등록 권장)
    setup_exceptions(app)
    
    # 2. CORS 및 보안 헤더 미들웨어 등록
    setup_middlewares(app)
    
    # 3. 라우터 등록
    setup_routers(app)
    
    return app


# FastAPI 실행 인스턴스
app = create_app()
app.mount("/media", StaticFiles(directory=settings.MEDIA_ROOT), name="media")
