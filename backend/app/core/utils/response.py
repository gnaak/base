from typing import Any, Generic, Optional, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel

T = TypeVar("T")


class BaseResponse(BaseModel, Generic[T]):
    """모든 응답의 겉포장. 프론트 `useAPI.ts`의 `BaseResponse<T>`와 1:1이다.

    제네릭이라 라우터에서 `response_model=BaseResponse[UserOut]` 처럼 안쪽 타입을
    지정할 수 있다. 그래야 `/docs`에 응답 스키마가 뜨고, FastAPI가 실제 응답을
    그 스키마로 **강제**한다 (스키마에 없는 필드는 잘려 나간다).
    """

    success: bool = True
    message: str = "ok"
    data: Optional[T] = None
    errorCode: Optional[str] = None


def success(data: Any = None, message: str = "ok") -> BaseResponse:
    """성공 응답을 만든다.

    ⚠️ `JSONResponse`가 아니라 **모델**을 반환한다. FastAPI가 라우터의
    `response_model`대로 직렬화·검증하게 하려면 이래야 한다. `JSONResponse`를
    반환하면 FastAPI가 손을 대지 않고 그대로 내보내서, 선언한 스키마와 실제
    응답이 달라도 아무도 잡지 못한다 (민감 필드가 그대로 새는 경로).

    - 상태코드는 라우터에서: `@router.post("/x", status_code=201)`
    - 쿠키·헤더는 `Response`를 파라미터로 주입받아서: `auth_router.login` 참고
    - datetime·Decimal·UUID·Enum은 FastAPI가 알아서 직렬화한다. 손으로
      `.isoformat()`을 부르지 말 것
    """
    return BaseResponse(success=True, message=message, data=data, errorCode=None)


def fail(
    message: str,
    error_code: Optional[str] = None,
    status_code: int = 400,
):
    """
    어디서든(서비스/라우터) 호출 가능한 공통 실패 헬퍼.
    실제 응답은 exception handler가 BaseResponse로 만들어줌.
    """
    exc = HTTPException(
        status_code=status_code,
        detail=message,
    )
    setattr(exc, "error_code", error_code)
    raise exc
