# 역할: CORS 설정을 FastAPI 애플리케이션에 적용하는 모듈

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config.settings import settings


# FastAPI 앱에 CORS 설정 미들웨어를 추가
def setup_cors(app: FastAPI):
    # 허용 오리진은 .env의 {local|prod}_domain에서 유도된다 (스킴은 env가 붙인다).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # 프론트 JS가 읽을 수 있게 노출 (로그 상관관계 추적용)
        expose_headers=["x-request-id", "x-process-time"],
    )
