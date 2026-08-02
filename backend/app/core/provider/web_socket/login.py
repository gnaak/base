from functools import wraps

from fastapi import WebSocket


def with_login_web_socket(type: str = "user"):
    """
    WebSocket용 로그인 필수 (기본: user)
    admin API에서는 with_login_web_socket("admin") 사용
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(p, websocket: WebSocket, *args, **kwargs):
            # import를 함수 안에서 한다 (순환 import 방지) — http/login.py와 같은 이유
            from app.module.auth.auth_token import AuthToken

            token_util = AuthToken()
            user_id, auth_type = await token_util.get_token_info_ws(websocket, type)
            websocket.user_id = user_id
            websocket.auth_type = auth_type
            return await func(p, websocket, *args, **kwargs)
        return wrapper
    return decorator


def without_login_web_socket(func):  # (type: str = "user") 처럼 인자를 받는 구조를 제거
    """
    로그인이 필요 없는 WebSocket 연결용 데코레이터
    """

    @wraps(func)
    async def wrapper(p, websocket: WebSocket, *args, **kwargs):
        # 인증 없이 기본값 주입
        websocket.user_id = "guest_user"
        websocket.auth_type = "guest"

        return await func(p, websocket, *args, **kwargs)

    return wrapper
