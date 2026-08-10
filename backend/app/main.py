# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.config.settings import settings
from app.core.database.base import engine
from app.core.database.redis import close_redis, get_redis
from app.core.middleware.register import setup_middlewares
from app.core.middleware.request_id import HEALTH_PATH
from app.core.exception.handler import setup_exceptions
from app.core.logging import setup_logging, get_logger
from app.core.utils.http_client import close_http_client, get_http_client
from app.core.utils.response import success
from app.module import *
from app.module.infra.gpt.gpt_service import close_openai_client

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

    # 연결 검증 (fail-fast) — 설정 오류를 첫 사용자 요청이 아니라 기동 시점에 잡는다
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✅ DB 연결 확인")
    except Exception:
        logger.error("❌ DB 연결 실패 — .env의 {env}_mysql_* 설정을 확인할 것", exc_info=True)
        raise
    try:
        await get_redis().ping()
        logger.info("✅ Redis 연결 확인")
    except Exception:
        logger.error("❌ Redis 연결 실패 — .env의 redis_* 설정을 확인할 것", exc_info=True)
        raise

    # 공용 아웃바운드 클라이언트를 앱 이벤트 루프에 미리 바인딩 (첫 요청이 생성 비용을 내지 않게)
    get_http_client()

    yield

    logger.info("🛑 Backend 종료 중...")
    await close_redis()
    await close_http_client()
    await close_openai_client()
    # 예: await ws_manager.close_all()


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    
    # 1. 예외 핸들러 등록 (가장 먼저 혹은 미들웨어 직후에 등록 권장)
    setup_exceptions(app)
    
    # 2. CORS 및 보안 헤더 미들웨어 등록
    setup_middlewares(app)
    
    # 3. 라우터 등록
    setup_routers(app)

    # 4. 헬스체크 — 무인증 liveness. LB·컨테이너 헬스체크용.
    #    도메인이 아니라 인프라용이라 setup_routers()가 아닌 여기에 직접 둔다.
    #    경로 상수는 middleware/request_id.py의 HEALTH_PATH와 공유 (액세스 로그 제외 대상)
    @app.get(HEALTH_PATH)
    async def health():
        return success({"status": "ok"})

    return app


# FastAPI 실행 인스턴스
app = create_app()
app.mount("/media", StaticFiles(directory=settings.MEDIA_ROOT), name="media")
