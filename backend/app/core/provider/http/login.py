from functools import wraps


def with_login(type: str = "user"):
    """
    로그인 필수 (기본: user)
    admin API에서는 with_login("admin") 사용

    토큰이 없거나 무효하면 get_token_info가 401 HTTPException을 던지고,
    전역 예외 핸들러가 BaseResponse로 변환한다.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(p, *args, **kwargs):
            # import를 함수 안에서 한다 (ServiceProvider와 같은 이유).
            # app.module이 라우터를 통해 이 모듈을 import하므로, 최상단에 두면
            # 이 모듈을 app.module보다 먼저 import했을 때 순환 import로 깨진다.
            from app.module.auth.auth_token import AuthToken

            token_util = AuthToken()
            user_id, auth_type = await token_util.get_token_info(p.request, type)
            p.request.user_id = user_id
            p.request.auth_type = auth_type
            return await func(p, *args, **kwargs)
        return wrapper
    return decorator

def without_login(func):
    """
    로그인이 필요 없는 API용 데코레이터
    (기본 user_id, auth_type 세팅)
    """

    @wraps(func)
    async def wrapper(p, *args, **kwargs):
        request = p.request

        # 기본값 세팅 (로그인 안 한 상태)
        request.user_id = getattr(request, "user_id", "guest_user")
        request.auth_type = getattr(request, "auth_type", "guest")

        return await func(p, *args, **kwargs)

    return wrapper
