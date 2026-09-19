# app/module/auth/auth_router.py

from fastapi import APIRouter, Response

from app.core.provider.http.deps import AdminProvider, Provider, UserProvider
from app.core.utils.rate_limit import LOGIN_LIMIT, SIGNUP_LIMIT
from app.core.utils.response import BaseResponse, fail, success
from app.module.auth.auth_schema import LoginIn, OAuthCodeIn, SessionOut, SignupIn

router = APIRouter()

# 쿠키를 심는 라우트는 `response: Response` 를 파라미터로 주입받는다.
# 거기에 심은 쿠키·헤더를 FastAPI가 최종 응답에 합쳐준다 — 예전처럼 success()가
# 돌려준 응답 객체에 심지 않아도 되고, 덕분에 라우트가 모델을 반환할 수 있다
# (= response_model 이 실제로 강제된다).


@router.post(
    "/signup",
    dependencies=[SIGNUP_LIMIT],
    response_model=BaseResponse[None],
    status_code=201,
)
async def signup(body: SignupIn, p: Provider):
    """가입만 하고 세션은 만들지 않는다 — 프론트가 이어서 /login 을 부른다.

    가입 직후 자동 로그인이 필요하면 login 처럼 `response: Response` 를 받아
    `create_jwt_token()` 을 부르면 된다. 프로젝트마다 다른 선택이라 기본은 단순하게 뒀다.
    """
    await p.auth_service.signup(body)
    return success(message="signup successful")


@router.post("/login", dependencies=[LOGIN_LIMIT], response_model=BaseResponse[SessionOut])
async def login(body: LoginIn, response: Response, p: Provider):
    user, auth_type = await p.auth_service.login(body)
    session = await p.auth_service.token_util.create_jwt_token(user, response, auth_type)
    return success(session, message="user login successful")


@router.post("/logout", response_model=BaseResponse[None])
async def logout(response: Response, p: UserProvider):
    # 쿠키만 지우면 토큰 자체는 만료까지 살아있다 — 이 세션을 거부 목록에 올린다.
    # 다른 기기의 세션은 유지된다 (전체 종료는 revoke_all_sessions).
    await p.auth_service.token_util.revoke_current_session(p.request, p.auth.auth_type)
    await p.auth_service.token_util.delete_token(response, p.auth.auth_type)
    return success(message="user logout successful")


@router.post("/logout_admin", response_model=BaseResponse[None])
async def logout_admin(response: Response, p: AdminProvider):
    await p.auth_service.token_util.revoke_current_session(p.request, p.auth.auth_type)
    await p.auth_service.token_util.delete_token(response, p.auth.auth_type)
    return success(message="admin logout successful")


@router.post("/refresh_token", response_model=BaseResponse[SessionOut])
async def refresh_token(response: Response, p: Provider):
    user_id, _ = await p.auth_service.token_util.verify_refresh_by_type(p.request, "user")
    user = await p.user_service.get_user_by_id(user_id)
    if not user:
        fail("user not found", "USER_NOT_FOUND", 404)

    session = await p.auth_service.token_util.create_jwt_token(user, response, "user")
    # 로테이션 — 방금 쓴 refresh 토큰을 무효화한다. 새 토큰을 발급한 **뒤에** 부른다.
    await p.auth_service.token_util.rotate_refresh(p.request, "user")
    return success(session, message="user login successful")


@router.post("/refresh_token_admin", response_model=BaseResponse[SessionOut])
async def refresh_token_admin(response: Response, p: Provider):
    admin_id, _ = await p.auth_service.token_util.verify_refresh_by_type(p.request, "admin")
    admin = await p.admin_service.get_admin_by_id(admin_id)
    if not admin:
        fail("admin not found", "ADMIN_NOT_FOUND", 404)

    session = await p.auth_service.token_util.create_jwt_token(admin, response, "admin")
    await p.auth_service.token_util.rotate_refresh(p.request, "admin")
    return success(session, message="admin login successful")


@router.post("/google", dependencies=[LOGIN_LIMIT], response_model=BaseResponse[SessionOut])
async def google_login(body: OAuthCodeIn, response: Response, p: Provider):
    user = await p.google_service.google_login(body.code)
    session = await p.auth_service.token_util.create_jwt_token(user, response, "user")
    return success(session, message="user login successful")


@router.post("/kakao", dependencies=[LOGIN_LIMIT], response_model=BaseResponse[SessionOut])
async def kakao_login(body: OAuthCodeIn, response: Response, p: Provider):
    user = await p.kakao_service.kakao_login(body.code)
    session = await p.auth_service.token_util.create_jwt_token(user, response, "user")
    return success(session, message="user login successful")
