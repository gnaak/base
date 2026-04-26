# 역할: CORS 설정을 FastAPI 애플리케이션에 적용하는 모듈

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# FastAPI 앱에 CORS 설정 미들웨어를 추가
def setup_cors(app: FastAPI):
    # TODO: domain 추가
    origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
    app.add_middleware(
        CORSMiddleware,
        # allow_origins=settings.cors_origins,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
