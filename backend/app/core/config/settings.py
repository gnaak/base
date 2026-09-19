# app/core/config/settings.py
import ipaddress
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

    # TEST — pytest 전용 DB 이름. 접속 정보는 local_* 을 그대로 쓴다.
    # 매 테스트 세션마다 테이블을 만들고 지우므로 반드시 전용 DB를 줄 것.
    test_mysql_db: str = "db_base_test"

    jwt_secret: str
    hash_key: str

    # 토큰 수명. 프로젝트 성격에 맞게 .env에서 조정한다.
    #
    #   access_token_minutes = 무효화(로그아웃·비번변경·정지)가 적용되기까지의 **지연**이다.
    #     refresh 시점에만 무효화를 확인하므로, 이 값이 곧 최대 지연이 된다.
    #   refresh_token_hours = 재로그인 없이 세션이 유지되는 기간.
    #
    #   | 성격                | access | refresh    |
    #   | 관리자 도구·내부     | 15~30분 | 8~12시간   |
    #   | 일반 웹 서비스       | 15~30분 | 3~14일     |
    #   | 금융·의료           | 5~15분  | 30분~2시간 |
    #
    # refresh는 로테이션 + 재사용 탐지가 걸려 있어서(module/auth/auth_revoke.py)
    # 며칠 단위로 잡아도 된다. 갱신할 때마다 옛 토큰이 죽고, 죽은 토큰이 다시
    # 오면 유출로 보고 그 계정의 모든 세션을 끊는다.
    access_token_minutes: int = 30
    refresh_token_hours: int = 168  # 7일 (2주는 336)

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

    # 사이트 도메인 (쉼표 구분). CORS 허용 오리진과 쿠키 도메인을 여기서 함께 유도한다.
    #
    #   local_domain=localhost:3000,127.0.0.1:3000
    #   prod_domain=gnaak.com
    #
    # - 스킴은 쓰지 않는다. env에 따라 자동으로 붙는다 (local→http, prod→https)
    # - 앞에 점을 찍으면(.gnaak.com) 쿠키를 서브도메인까지 공유한다.
    #   점이 없으면 host-only 쿠키 — 범위가 제일 좁아 안전하고, 대부분 이게 맞다
    local_domain: str = "localhost:3000,127.0.0.1:3000"
    prod_domain: str = ""

    # 쿠키의 SameSite 속성. lax | strict | none
    #
    # **기본 lax 가 곧 CSRF 방어다.** 브라우저가 cross-site 요청에 쿠키를 붙이지 않으므로,
    # 악성 사이트가 사용자의 브라우저를 시켜 우리 API를 호출해도 인증이 안 된다.
    #
    # `none` 은 그 방어를 끄는 값이다. 프론트와 백엔드가 **다른 사이트**일 때만 쓴다
    # (Vercel + 별도 API 도메인, 서드파티 iframe 임베드 등). 이 템플릿의 인증은 프론트 JS가
    # `user_info` 쿠키를 직접 읽는 구조라 원래 same-site를 전제하므로, 대부분 lax 로 충분하다.
    #
    # ⚠️ `none` 은 `Secure` 가 함께 있어야 브라우저가 받아준다(= HTTPS 필수).
    #    그리고 켜는 순간 CSRF 토큰이나 Origin 검증을 따로 붙여야 한다.
    cookie_samesite: str = "lax"

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
    def test_database_url(self) -> str:
        """
        pytest 전용 DB URL.

        접속 정보는 **항상 local_* 을 쓰고** DB 이름만 test_mysql_db 로 바꾼다.
        self.env를 타지 않는 게 핵심이다 — APP_ENV=prod 인 셸에서 실수로 pytest를
        돌려도 운영 DB에 붙지 않는다. 테스트는 테이블을 drop 하므로 이 보호가 필요하다.
        """
        user = quote_plus(self.raw.local_mysql_user)
        password = quote_plus(self.raw.local_mysql_password)
        return (
            f"mysql+aiomysql://{user}:{password}"
            f"@{self.raw.local_mysql_host}:{self.raw.mysql_port}/{self.raw.test_mysql_db}"
        )

    @property
    def jwt_secret(self) -> str:
        return self.raw.jwt_secret

    @property
    def hash_key(self) -> str:
        return self.raw.hash_key

    @property
    def access_token_minutes(self) -> int:
        return self.raw.access_token_minutes

    @property
    def refresh_token_hours(self) -> int:
        return self.raw.refresh_token_hours

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

    # 도메인 설정 — CORS 오리진과 쿠키 도메인을 {env}_domain 하나에서 유도한다
    @property
    def domains(self) -> list[str]:
        """`.env`에 적힌 도메인 목록. 앞의 점(서브도메인 공유 표시)은 그대로 둔다."""
        raw = getattr(self.raw, f"{self.env}_domain") or ""
        return [entry.strip() for entry in raw.split(",") if entry.strip()]

    @property
    def scheme(self) -> str:
        return "https" if self.env == "prod" else "http"

    @property
    def cors_origins(self) -> list[str]:
        """
        CORS 허용 오리진. 도메인마다 스킴을 붙여서 만든다.

        CORS는 포트까지 따지므로 `localhost:3000`처럼 포트를 적은 그대로 써야 한다.
        (쿠키는 반대로 포트를 구분하지 않는다 — cookie_domain 참고)
        """
        return [f"{self.scheme}://{entry.lstrip('.')}" for entry in self.domains]

    @property
    def cookie_domain(self) -> Optional[str]:
        """
        쿠키의 domain 속성. **기본은 None(host-only)** 이다.

        `.gnaak.com`처럼 앞에 점을 찍은 항목이 있을 때만 그 도메인을 돌려주고,
        그러면 쿠키가 해당 도메인과 **모든 서브도메인**에 실린다.
        프론트·백엔드가 서로 다른 서브도메인일 때만 이렇게 쓴다.

        - 포트는 뗀다. 쿠키는 포트를 구분하지 않는다
        - localhost나 IP에는 domain 속성을 붙이지 않는다 (브라우저가 거부하거나 무시한다)
        """
        for entry in self.domains:
            if not entry.startswith("."):
                continue

            host = entry.lstrip(".").split(":")[0]
            if host == "localhost":
                return None
            try:
                ipaddress.ip_address(host)
            except ValueError:
                return host  # 정상적인 도메인
            return None  # IP 주소

        return None

    @property
    def cookie_secure(self) -> bool:
        return self.env == "prod"

    @property
    def cookie_samesite(self) -> str:
        """`.env`의 `cookie_samesite`. 모르는 값이면 가장 안전한 `Lax`로 떨어진다.

        예전에는 prod에서 무조건 `None`이었다. 그건 브라우저의 CSRF 기본 방어를
        스스로 끄는 값인데, 이 템플릿은 프론트 JS가 쿠키를 읽어야 해서 원래
        same-site를 전제한다 — 켜둘 이유가 없었다.
        """
        value = (self.raw.cookie_samesite or "").strip().lower()
        if value not in ("lax", "strict", "none"):
            return "Lax"
        return {"lax": "Lax", "strict": "Strict", "none": "None"}[value]

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
        if not self.domains:
            warnings.append(
                f"{self.env}_domain 이 비어 있습니다. 프론트가 백엔드와 다른 오리진(포트만 달라도 해당)에 "
                "있으면 CORS로 전부 차단됩니다. 완전한 same-origin 배포라면 무시해도 됩니다."
            )

        raw_samesite = (self.raw.cookie_samesite or "").strip().lower()
        if raw_samesite and raw_samesite not in ("lax", "strict", "none"):
            warnings.append(
                f"cookie_samesite 값 '{self.raw.cookie_samesite}' 을 알 수 없어 Lax로 동작합니다. "
                "lax / strict / none 중 하나여야 합니다."
            )
        if self.cookie_samesite == "None":
            warnings.append(
                "cookie_samesite=none 입니다. 브라우저의 CSRF 기본 방어가 꺼집니다 — "
                "악성 사이트가 사용자의 브라우저를 시켜 이 API를 호출하면 쿠키가 그대로 실립니다. "
                "프론트·백엔드가 정말 다른 사이트인지 확인하고, 맞다면 CSRF 토큰이나 Origin 검증을 붙이세요."
            )
            if not self.cookie_secure:
                warnings.append(
                    "cookie_samesite=none 인데 secure=False 입니다. 브라우저가 이 조합의 쿠키를 "
                    "**거부**하므로 로그인이 아예 안 잡힙니다 (SameSite=None 은 HTTPS 필수)."
                )

        return warnings

    def describe(self) -> str:
        return (
            f"env={self.env} (근거: {self.env_source}) | "
            f"db={self.mysql_host}:{self.mysql_port}/{self.mysql_db} | "
            f"redis={self.redis_host}:{self.redis_port} | "
            f"cors={self.cors_origins} | "
            f"cookie(domain={self.cookie_domain or 'host-only'}, "
            f"secure={self.cookie_secure}, samesite={self.cookie_samesite})"
        )


# 전역 인스턴스
settings = Settings()
DATABASE_URL = settings.database_url
