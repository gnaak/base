"""라우터가 쓰는 의존성.

라우터는 아래 세 이름 중 하나를 **파라미터 타입으로 적기만 하면** DI와 인증이 끝난다.

    @router.get("/me")
    async def get_me(p: UserProvider):              # 로그인 필수(user)
        return success(await p.user_service.get_me(p.auth.user_id))

    @router.post("/login")
    async def login(body: LoginIn, p: Provider):    # 비로그인
        ...

    @router.delete("/group/{group_id}")
    async def remove(group_id: int, p: AdminProvider):   # 관리자 전용
        ...

핵심은 **시그니처를 지우지 않는다**는 것이다. 예전에는 `@with_provider`가 함수를
`(p)` 하나로 감싸버려서 FastAPI가 path/query/body를 볼 수 없었다. 그 결과
`/docs`가 비어 있었고, 잘못된 입력이 422가 아니라 500으로 나갔다.

⚠️ `Annotated[..., Depends(...)]`는 기본값이 없으므로 **기본값 있는 파라미터보다 앞**에 온다.

    async def list_items(p: UserProvider, page: int = 1):   # ✅
    async def list_items(page: int = 1, p: UserProvider):   # ❌ SyntaxError
"""
from typing import Annotated, Optional

from fastapi import Depends, Request

from app.core.database.base import get_session
from app.core.provider.http.service import Auth, ServiceProvider


def provider(auth: Optional[str] = None):
    """ServiceProvider를 만들어 주는 의존성을 생성한다.

    - `provider()`            → 인증 안 함. `p.auth`는 None
    - `provider("user")`      → user 토큰 필수
    - `provider("admin")`     → admin 토큰 필수

    토큰이 없거나 무효하면 `auth_token.get_token_info`가 401을 던지고,
    전역 예외 핸들러가 BaseResponse로 변환한다.
    """

    async def dep(request: Request, db=Depends(get_session)) -> ServiceProvider:
        p = ServiceProvider(request, db)

        if auth:
            # import를 함수 안에서 한다 — `app.module`이 라우터를 통해 이 모듈을
            # 끌어오므로, 최상단에 두면 순환 import로 깨진다.
            from app.module.auth.auth_token import AuthToken

            user_id, auth_type = await AuthToken().get_token_info(request, auth)
            p.auth = Auth(user_id=user_id, auth_type=auth_type)

        return p

    return dep


#: 비로그인. `p.auth` 는 None
Provider = Annotated[ServiceProvider, Depends(provider())]

#: user 로그인 필수. `p.auth.user_id` 사용 가능
UserProvider = Annotated[ServiceProvider, Depends(provider("user"))]

#: admin 로그인 필수
AdminProvider = Annotated[ServiceProvider, Depends(provider("admin"))]
