# app/core/config/settings.py
import os
import socket
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class RawEnv(BaseSettings):
    # PostgreSQL 설정
    postgres_port: int = 5432

    # LOCAL
    local_postgres_user: str
    local_postgres_password: str
    local_postgres_host: str
    local_postgres_db: str

    # PROD
    prod_postgres_user: str
    prod_postgres_password: str
    prod_postgres_host: str
    prod_postgres_db: str

    jwt_secret: str
    hash_key: str

    # API keys
    openai_api_key: Optional[str] = None

    # KAKAO
    kakao_client_id: Optional[str] = None
    kakao_client_secret: Optional[str] = None
    local_kakao_redirect_uri: Optional[str] = None
    prod_kakao_redirect_uri: Optional[str] = None

    # GOOGLE
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    local_google_redirect_uri: Optional[str] = None
    prod_google_redirect_uri: Optional[str] = None

    # REDIS
    local_redis_host: str
    local_redis_port: int
    local_redis_password: Optional[str] = None

    prod_redis_host: str
    prod_redis_port: int
    prod_redis_password: Optional[str] = None

    model_config = SettingsConfigDict(env_file=os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"), env_file_encoding="utf-8")

class Settings:
    def __init__(self):
        self.raw = RawEnv()
        self.env = self._detect_env()
        self.BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
        self.APP_DIR = self.BASE_DIR / "app"
        self.MEDIA_ROOT = self.BASE_DIR / "media"

    def _detect_env(self) -> str:
        app_env = os.getenv("APP_ENV", "").lower()
        if app_env in ("prod", "production"):
            return "prod"
        if app_env in ("local", "development"):
            return "local"
        hostname = socket.gethostname().lower()
        if hostname == "homeserver":
            return "prod"
        return "local"

    # PostgreSQL 설정
    @property
    def postgres_user(self) -> str:
        return getattr(self.raw, f"{self.env}_postgres_user")

    @property
    def postgres_password(self) -> str:
        return getattr(self.raw, f"{self.env}_postgres_password")

    @property
    def postgres_host(self) -> str:
        return getattr(self.raw, f"{self.env}_postgres_host")

    @property
    def postgres_db(self) -> str:
        return getattr(self.raw, f"{self.env}_postgres_db")

    @property
    def postgres_port(self) -> int:
        return self.raw.postgres_port

    # SQLAlchemy용 비동기 DB URL
    @property
    def database_url(self) -> str:
        user = quote_plus(self.postgres_user)
        password = quote_plus(self.postgres_password)
        host = self.postgres_host
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def jwt_secret(self) -> str:
        return self.raw.jwt_secret

    @property
    def hash_key(self) -> str:
        return self.raw.hash_key

    # API Keys
    @property
    def openai_api_key(self) -> Optional[str]:
        return self.raw.openai_api_key

    @property
    def kakao_client_id(self) -> Optional[str]:
        return self.raw.kakao_client_id

    @property
    def kakao_client_secret(self) -> Optional[str]:
        return self.raw.kakao_client_secret

    @property
    def kakao_redirect_uri(self) -> Optional[str]:
        return getattr(self.raw, f"{self.env}_kakao_redirect_uri")

    @property
    def google_client_id(self) -> Optional[str]:
        return self.raw.google_client_id

    @property
    def google_client_secret(self) -> Optional[str]:
        return self.raw.google_client_secret

    @property
    def google_redirect_uri(self) -> str:
        return getattr(self.raw, f"{self.env}_google_redirect_uri")

    # Redis 설정
    @property
    def redis_host(self) -> str:
        return getattr(self.raw, f"{self.env}_redis_host")

    @property
    def redis_port(self) -> int:
        return getattr(self.raw, f"{self.env}_redis_port")

    @property
    def redis_password(self) -> Optional[str]:
        return getattr(self.raw, f"{self.env}_redis_password")


# 전역 인스턴스
settings = Settings()
DATABASE_URL = settings.database_url
