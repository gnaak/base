# app/module/auth/auth_token.py

import base64
import json
import uuid
from datetime import timedelta

import jwt
from fastapi.encoders import jsonable_encoder

from app.core.config.settings import settings
from app.core.database.base import now_kst
from app.core.utils.response import fail


class AuthToken:
    def __init__(self):
        self.jwt_secret = settings.jwt_secret
        self.hash_key = settings.hash_key
        self.algorithm = "HS256"
        self.env = settings.env
        # 수명은 .env에서 온다. access 수명 = 무효화가 적용되기까지의 최대 지연.
        self.access_ttl = timedelta(minutes=settings.access_token_minutes)
        self.refresh_ttl = timedelta(hours=settings.refresh_token_hours)
        # 쿠키 속성은 전부 settings에서 온다 (.env의 {local|prod}_domain에서 유도)
        self.samesite = settings.cookie_samesite
        self.domain = settings.cookie_domain
        self.secure = settings.cookie_secure

    def _cookie_common(self) -> dict:
        """4종 쿠키에 공통으로 붙는 속성. domain은 설정된 경우에만 넣는다."""
        common = {
            "secure": self.secure,
            "samesite": self.samesite,
            "path": "/",
        }
        if self.domain:
            common["domain"] = self.domain
        return common


    # --- 쿠키 접두사 생성 ---
    def _cookie_prefix(self, auth_type: str):
        return "admin_" if auth_type == "admin" else "user_"

    # --- 공통 로직 분리 ---
    def _get_user_from_cookies(self, cookies, auth_type: str):
        prefix = self._cookie_prefix(auth_type)

        access_token = cookies.get(f"{prefix}access_token")
        if not access_token:
            raise fail("access token missing", "ACCESS_TOKEN_MISSING", 401)

        try:
            payload = jwt.decode(
                access_token,
                self.jwt_secret,
                algorithms=[self.algorithm],
            )
        except jwt.ExpiredSignatureError:
            raise fail("access token expired", "ACCESS_TOKEN_EXPIRED", 401)
        except jwt.InvalidTokenError:
            raise fail("invalid access token", "ACCESS_TOKEN_INVALID", 401)

        if payload.get("type") != "access":
            raise fail("not an access token", "INVALID_TOKEN_TYPE", 401)

        # user 토큰으로 admin API에 접근하는 경우 (혹은 그 반대)
        if payload.get("user") != auth_type:
            raise fail("auth type mismatch", "INVALID_TOKEN_TYPE", 401)

        return int(payload["sub"]), payload["user"]

    # --- HTTP용 ---
    async def get_token_info(self, request, auth_type: str):
        """유저 아이디 토큰에서 파싱 (HTTP Request)"""
        return self._get_user_from_cookies(request.cookies, auth_type)

    # --- WebSocket용 ---
    async def get_token_info_ws(self, websocket, auth_type: str):
        """유저 아이디 토큰에서 파싱 (WebSocket)"""
        return self._get_user_from_cookies(websocket.cookies, auth_type)

    # --- 토큰 생성 ---
    async def create_jwt_token(self, user, response, type):
        """쿠키 4종을 심고, 세션 정보를 `SessionOut`으로 반환한다.

        반환값은 `{p}user_info` 쿠키에 담기는 것과 **같은 객체**다. 라우터가 이걸
        응답 `data`에 그대로 실으면, 프론트는 쿠키를 파싱하지 않고도 세션 정보를
        받을 수 있고 둘이 어긋날 수가 없다.
        """
        from app.module.auth.auth_revoke import current_version
        from app.module.auth.auth_schema import SessionOut

        # 세션을 발급하는 **유일한 지점**이라, 계정 상태 검사를 여기 둔다.
        # 로그인·OAuth·refresh가 전부 이 함수를 지나므로 한 번만 쓰면 된다.
        # (tb_admins에는 active 컬럼이 없으므로 기본값 True)
        if not getattr(user, "active", True):
            fail("비활성화된 계정입니다", "ACCOUNT_DISABLED", 403)

        now_kr = now_kst()
        prefix = self._cookie_prefix(type)

        # 이 계정의 현재 세션 버전. 비밀번호 변경·계정 정지 시 올라가고,
        # 그러면 예전에 발급된 토큰의 ver가 뒤처져서 refresh가 거부된다.
        # strict=False — Redis가 죽었다고 로그인까지 막지는 않는다 (auth_revoke 주석 참고)
        version = await current_version(user.id, type, strict=False)

        access_payload = {
            "sub": str(user.id),
            "user": type,
            "type": "access",
            "ver": version,
            "exp": now_kr + self.access_ttl,
        }

        refresh_payload = {
            "sub": str(user.id),
            "user": type,
            "type": "refresh",
            "ver": version,
            # 로그아웃 시 이 세션 하나만 끊을 수 있게 식별자를 붙인다
            "jti": str(uuid.uuid4()),
            "exp": now_kr + self.refresh_ttl,
        }

        access_token = jwt.encode(access_payload, self.jwt_secret, algorithm=self.algorithm)
        refresh_token = jwt.encode(refresh_payload, self.jwt_secret, algorithm=self.algorithm)

        session = SessionOut(
            auth_type=type,
            id=user.id,
            user_nickname="admin" if type == "admin" else user.name,
            created_at=user.created_at,
        )

        # 공통 쿠키 설정.
        # jsonable_encoder가 datetime을 ISO 문자열로 바꿔준다 — 손으로 isoformat()을 부르지 않는다.
        encoded_info = base64.b64encode(
            json.dumps(jsonable_encoder(session), ensure_ascii=False).encode("utf-8")
        ).decode("utf-8")

        # 프론트에서 읽어야 하므로 httponly=False
        cookie_common = self._cookie_common()

        # 쿠키 수명은 토큰 수명을 그대로 따라간다 (.env의 access_token_minutes / refresh_token_hours).
        # user_info를 access와 맞추는 이유: 프론트가 "로그인 상태"라고 믿는 기간이
        # access 토큰이 유효한 기간과 같아야, 라우트 가드의 refresh 시도가 의도적으로 일어난다.
        access_age = int(self.access_ttl.total_seconds())
        refresh_age = int(self.refresh_ttl.total_seconds())

        response.set_cookie(
            key=f"{prefix}user_info",
            value=encoded_info,
            httponly=False,
            max_age=access_age,
            **cookie_common,
        )

        response.set_cookie(
            key=f"{prefix}access_token",
            value=access_token,
            httponly=True,
            max_age=access_age,
            **cookie_common,
        )

        response.set_cookie(
            key=f"{prefix}refresh_token",
            value=refresh_token,
            httponly=True,
            max_age=refresh_age,
            **cookie_common,
        )

        response.set_cookie(
            key=f"{prefix}refresh_exp",
            value=jwt.encode({"uuid": str(uuid.uuid4())}, settings.jwt_secret, algorithm="HS256"),
            **cookie_common,
            max_age=refresh_age,
        )

        return session

    async def verify_refresh_by_type(self, request, auth_type: str):
        """
        지정된 auth_type의 refresh_token만 검증한다.
        - auth_type: "user" | "admin"
        """
        if auth_type not in ("user", "admin"):
            raise fail("invalid auth type", "INVALID_AUTH_TYPE", 400)

        prefix = self._cookie_prefix(auth_type)
        refresh_token = request.cookies.get(f"{prefix}refresh_token")
        if not refresh_token:
            raise fail("refresh token missing", "REFRESH_TOKEN_MISSING", 401)

        try:
            payload = jwt.decode(
                refresh_token,
                self.jwt_secret,
                algorithms=[self.algorithm],
            )
        except jwt.ExpiredSignatureError:
            raise fail("refresh token expired", "REFRESH_TOKEN_EXPIRED", 401)
        except jwt.InvalidTokenError:
            raise fail("invalid refresh token", "INVALID_REFRESH_TOKEN", 401)

        if payload.get("type") != "refresh":
            raise fail("not a refresh token", "INVALID_TOKEN_TYPE", 401)

        user_id = payload.get("sub")
        token_type = payload.get("user")

        if not user_id or token_type != auth_type:
            raise fail("invalid refresh payload", "INVALID_REFRESH_PAYLOAD", 401)

        # 서명·만료를 통과했어도 끊긴 세션일 수 있다 (로그아웃·비번변경·계정정지).
        # 무효화 확인은 여기 한 곳뿐이므로, 반영까지 최대 access 토큰 수명만큼 걸린다.
        from app.module.auth.auth_revoke import ensure_not_revoked

        await ensure_not_revoked(payload)

        return int(user_id), auth_type

    def _current_refresh(self, request, auth_type: str):
        """쿠키에 들어있는 refresh 토큰의 `(jti, 남은 수명 초)`. 없거나 망가졌으면 None.

        만료 검증은 끈다 — 만료된 토큰은 어차피 못 쓰지만, 남은 수명을 계산하려면
        payload 자체는 읽어야 한다.
        """
        prefix = self._cookie_prefix(auth_type)
        raw = request.cookies.get(f"{prefix}refresh_token")
        if not raw:
            return None

        try:
            payload = jwt.decode(
                raw, self.jwt_secret, algorithms=[self.algorithm],
                options={"verify_exp": False},
            )
        except jwt.InvalidTokenError:
            return None

        exp = payload.get("exp")
        jti = payload.get("jti")
        if not exp or not jti:
            return None

        return jti, int(exp - now_kst().timestamp())

    async def revoke_current_session(self, request, auth_type: str) -> None:
        """로그아웃 — **이 세션 하나만** 끊는다 (다른 기기는 유지).

        쿠키 삭제는 라우터가 따로 한다. 여기서는 토큰 자체를 거부 목록에 올린다.
        """
        from app.module.auth.auth_revoke import deny_token

        current = self._current_refresh(request, auth_type)
        if current:
            await deny_token(*current)

    async def rotate_refresh(self, request, auth_type: str) -> None:
        """로테이션 — 방금 사용한 refresh 토큰을 무효화한다.

        **새 토큰을 발급한 뒤에** 부른다. 이후 같은 토큰이 또 오면
        (유예 시간 밖이라면) 유출로 보고 전체 세션을 끊는다.
        """
        from app.module.auth.auth_revoke import rotate_token

        current = self._current_refresh(request, auth_type)
        if current:
            await rotate_token(*current)

    async def delete_token(self, response, auth_type: str):
        """토큰 삭제 및 로그아웃 처리"""
        prefix = self._cookie_prefix(auth_type)
        cookie_common = self._cookie_common()

        response.delete_cookie(f"{prefix}access_token", **cookie_common)
        response.delete_cookie(f"{prefix}refresh_token", **cookie_common)
        response.delete_cookie(f"{prefix}user_info", **cookie_common)
        response.delete_cookie(f"{prefix}refresh_exp", **cookie_common)
