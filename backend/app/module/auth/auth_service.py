# app/module/auth/auth_service.py

from passlib.context import CryptContext

from app.core.utils.rate_limit import (
    check_login_attempts,
    clear_login_failures,
    record_login_failure,
)
from app.core.utils.response import fail
from app.module.admin.admin_repository import AdminRepository
from app.module.auth.auth_schema import LoginIn, SignupIn
from app.module.auth.auth_token import AuthToken
from app.module.user.user_repository import UserRepository

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

class AuthService:
    def __init__(self, user_repo: UserRepository, admin_repo: AdminRepository):
        self.user_repo = user_repo
        self.admin_repo = admin_repo
        self.token_util = AuthToken()

    # -- 회원가입
    async def signup(self, body: SignupIn):
        original = await self.user_repo.get_user_by_email(body.email)
        if original:
            fail("user already exists", "USER_ALREADY_EXISTS", 409)

        hashed_password = hash_password(body.password)
        await self.user_repo.create_user(body.email, body.nickname, hashed_password)

    # -- 일반 로그인
    async def login(self, body: LoginIn):
        """`body.type` 이 user/admin 중 하나인 것은 스키마가 이미 보장한다.

        라우터의 `LOGIN_LIMIT` 이 IP 단위로 막고, 여기서는 **계정 단위**로 막는다.
        IP를 바꿔가며 한 계정을 두드리는 크리덴셜 스터핑은 IP 제한으로 못 잡는다
        (앞단의 nginx·Cloudflare도 마찬가지다).
        """
        # 비밀번호를 검사하기 전에 확인한다 — 잠긴 계정에 argon2 비용을 쓰지 않는다
        await check_login_attempts(body.email)

        if body.type == "user":
            user_obj = await self.user_repo.get_user_by_email(body.email)
        else:
            user_obj = await self.admin_repo.get_admin_by_email(body.email)

        if not user_obj or not verify_password(body.password, user_obj.password):
            # 계정이 없는 경우도 센다 — 안 그러면 이메일 존재 여부를 알아내는 통로가 된다
            await record_login_failure(body.email)
            fail("user does not exists", "USER_DOES_NOT_EXISTS", 404)

        await clear_login_failures(body.email)

        # 로그인 시각 기록. tb_admins에는 last_login_at 컬럼이 없어서 user만 갱신한다.
        # (OAuth 로그인은 user_repo.get_or_create_user가 알아서 갱신한다)
        if body.type == "user":
            user_obj = await self.user_repo.update_last_login(user_obj)

        return user_obj, body.type
