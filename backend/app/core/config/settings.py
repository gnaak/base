# app/core/config/settings.py
import os
import socket
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class RawEnv(BaseSettings):
    # MySQL 설정
    mysql_port: int = 3306

    # LOCAL
    local_mysql_user: str
    local_mysql_password: str
    local_mysql_host: str
    local_mysql_db: str

    # PROD
    prod_mysql_user: str
    prod_mysql_password: str
    prod_mysql_host: str
    prod_mysql_db: str

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

    # CORS 허용 오리진 (쉼표 구분)
    local_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    prod_cors_origins: str = ""

    # 쿠키 도메인. 비워두면 host-only 쿠키가 된다 (프론트·백엔드가 같은 호스트일 때).
    # 서브도메인을 넘나들어야 하면 ".example.com" 처럼 지정한다.
    local_cookie_domain: Optional[str] = None
    prod_cookie_domain: Optional[str] = None

    model_config = SettingsConfigDict(env_file=os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"), env_file_encoding="utf-8")

class Settings:
    def __init__(self):
        self.raw = RawEnv()
        self.env, self.env_source = self._detect_env()
        self.BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
        self.APP_DIR = self.BASE_DIR / "app"
        self.MEDIA_ROOT = self.BASE_DIR / "media"

    def _detect_env(self) -> tuple[str, str]:
        """
        (env, 판단 근거)를 반환한다.

        APP_ENV를 명시하지 않으면 호스트명으로 추측하는데, 이 추측은 EC2 기본 호스트명에서만
        맞는다. Docker·Cloud Run처럼 호스트명이 다른 곳에 올리면 조용히 local로 떨어져서
        secure=False / samesite=Lax 쿠키가 나가고 "로그인은 200인데 세션이 안 잡히는" 증상이 난다.
        그래서 판단 근거를 함께 반환하고 기동 시 로그로 남긴다. **배포 환경에서는 APP_ENV를 명시할 것.**
        """
        app_env = os.getenv("APP_ENV", "").lower()
        if app_env in ("prod", "production"):
            return "prod", "APP_ENV"
        if app_env in ("local", "development"):
            return "local", "APP_ENV"

        hostname = socket.gethostname().lower()
        if hostname.startswith("ip-") or hostname.startswith("ec2-"):
            return "prod", f"hostname 추측({hostname})"
        return "local", "기본값(APP_ENV 미설정)"

    # MySQL 설정
    @property
    def mysql_user(self) -> str:
        return getattr(self.raw, f"{self.env}_mysql_user")

    @property
    def mysql_password(self) -> str:
        return getattr(self.raw, f"{self.env}_mysql_password")

    @property
    def mysql_host(self) -> str:
        return getattr(self.raw, f"{self.env}_mysql_host")

    @property
    def mysql_db(self) -> str:
        return getattr(self.raw, f"{self.env}_mysql_db")

    @property
    def mysql_port(self) -> int:
        return self.raw.mysql_port

    # SQLAlchemy용 비동기 DB URL
    @property
    def database_url(self) -> str:
        user = quote_plus(self.mysql_user)
        password = quote_plus(self.mysql_password)
        host = self.mysql_host
        return (
            f"mysql+aiomysql://{user}:{password}"
            f"@{host}:{self.mysql_port}/{self.mysql_db}"
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

    # CORS / 쿠키 설정
    @property
    def cors_origins(self) -> list[str]:
        raw = getattr(self.raw, f"{self.env}_cors_origins") or ""
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def cookie_domain(self) -> Optional[str]:
        """비어 있으면 None. 브라우저는 domain 속성이 없는 쿠키를 host-only로 저장한다."""
        value = getattr(self.raw, f"{self.env}_cookie_domain")
        return value.strip() or None if value else None

    @property
    def cookie_secure(self) -> bool:
        return self.env == "prod"

    @property
    def cookie_samesite(self) -> str:
        return "None" if self.env == "prod" else "Lax"

    def config_warnings(self) -> list[str]:
        """기동 시 로그로 남길 설정 경고. 세션이 조용히 깨지는 조합들을 잡는다."""
        warnings: list[str] = []

        if self.env == "prod" and self.env_source != "APP_ENV":
            warnings.append(
                "APP_ENV가 설정되지 않아 호스트명으로 prod를 추측했습니다. 배포 스크립트에 APP_ENV=prod를 명시하세요."
            )
        if self.env == "local" and self.env_source == "기본값(APP_ENV 미설정)":
            warnings.append(
                "APP_ENV가 없어 local로 동작합니다. 배포 환경이라면 쿠키가 secure=False로 나가 세션이 잡히지 않습니다."
            )
        if not self.cors_origins:
            warnings.append(
                f"{self.env}_cors_origins 가 비어 있습니다. 브라우저에서 오는 모든 요청이 CORS로 차단됩니다."
            )

        return warnings

    def describe(self) -> str:
        return (
            f"env={self.env} (근거: {self.env_source}) | "
            f"db={self.mysql_host}:{self.mysql_port}/{self.mysql_db} | "
            f"redis={self.redis_host}:{self.redis_port} | "
            f"cors={self.cors_origins} | "
            f"cookie(domain={self.cookie_domain}, secure={self.cookie_secure}, samesite={self.cookie_samesite})"
        )


# 전역 인스턴스
settings = Settings()
DATABASE_URL = settings.database_url
