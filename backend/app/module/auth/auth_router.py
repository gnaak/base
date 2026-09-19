# app/module/auth/auth_router.py

from fastapi import APIRouter

from app.core.provider.http.deps import AdminProvider, Provider, UserProvider
from app.core.utils.response import fail, success
from app.module.auth.auth_schema import LoginIn, OAuthCodeIn

router = APIRouter()


@router.post("/login")
async def login(body: LoginIn, p: Provider):
    user, auth_type = await p.auth_service.login(body)
    response = success(message="user login successful")
    await p.auth_service.token_util.create_jwt_token(user, response, auth_type)
    return response


@router.post("/logout")
async def logout(p: UserProvider):
    response = success(message="user logout successful")
    await p.auth_service.token_util.delete_token(response, p.auth.auth_type)
    return response


@router.post("/logout_admin")
async def logout_admin(p: AdminProvider):
    response = success(message="admin logout successful")
    await p.auth_service.token_util.delete_token(response, p.auth.auth_type)
    return response


@router.post("/refresh_token")
async def refresh_token(p: Provider):
    user_id, _ = await p.auth_service.token_util.verify_refresh_by_type(p.request, "user")
    user = await p.user_service.get_user_by_id(user_id)
    if not user:
        fail("user not found", "USER_NOT_FOUND", 404)

    response = success(message="user login successful")
    await p.auth_service.token_util.create_jwt_token(user, response, "user")
    return response


@router.post("/refresh_token_admin")
async def refresh_token_admin(p: Provider):
    admin_id, _ = await p.auth_service.token_util.verify_refresh_by_type(p.request, "admin")
    admin = await p.admin_service.get_admin_by_id(admin_id)
    if not admin:
        fail("admin not found", "ADMIN_NOT_FOUND", 404)

    response = success(message="admin login successful")
    await p.auth_service.token_util.create_jwt_token(admin, response, "admin")
    return response


@router.post("/google")
async def google_login(body: OAuthCodeIn, p: Provider):
    user = await p.google_service.google_login(body.code)
    response = success(message="user login successful")
    await p.auth_service.token_util.create_jwt_token(user, response, "user")
    return response


@router.post("/kakao")
async def kakao_login(body: OAuthCodeIn, p: Provider):
    user = await p.kakao_service.kakao_login(body.code)
    response = success(message="user login successful")
    await p.auth_service.token_util.create_jwt_token(user, response, "user")
    return response
