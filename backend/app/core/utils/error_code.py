"""`fail()`에 넘기는 `errorCode` 상수.

프론트가 `errorCode`로 분기하라고 문서에 써 놓고 비교할 상수를 주지 않으면,
양쪽에 문자열 리터럴이 흩어지고 오타가 조용히 통과한다. 여기가 유일한 출처다.

**프론트 `src/types/errorCode.ts`와 1:1로 맞춘다.** 여기에 추가하면 거기도 고칠 것.

```python
from app.core.utils.error_code import ErrorCode
fail("user not found", ErrorCode.USER_NOT_FOUND, 404)
```

`StrEnum`이라 문자열이 그대로 필요한 곳(`JSONResponse` 등)에서도 그냥 쓸 수 있다.
"""
from enum import StrEnum


class ErrorCode(StrEnum):
    # ── 공통 ──────────────────────────────────────────────
    HTTP_ERROR = "HTTP_ERROR"            # fail() 없이 맨 HTTPException을 던졌을 때
    INTERNAL_ERROR = "INTERNAL_ERROR"    # 미처리 예외
    VALIDATION_ERROR = "VALIDATION_ERROR"  # 요청 스키마 검증 실패 (422)
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS"  # 빈도 제한 (429)

    # ── 인증: 토큰 ────────────────────────────────────────
    ACCESS_TOKEN_MISSING = "ACCESS_TOKEN_MISSING"
    ACCESS_TOKEN_EXPIRED = "ACCESS_TOKEN_EXPIRED"
    ACCESS_TOKEN_INVALID = "ACCESS_TOKEN_INVALID"
    INVALID_TOKEN_TYPE = "INVALID_TOKEN_TYPE"
    INVALID_AUTH_TYPE = "INVALID_AUTH_TYPE"
    REFRESH_TOKEN_MISSING = "REFRESH_TOKEN_MISSING"
    REFRESH_TOKEN_EXPIRED = "REFRESH_TOKEN_EXPIRED"
    INVALID_REFRESH_TOKEN = "INVALID_REFRESH_TOKEN"
    INVALID_REFRESH_PAYLOAD = "INVALID_REFRESH_PAYLOAD"

    # ── 인증: 세션 ────────────────────────────────────────
    SESSION_REVOKED = "SESSION_REVOKED"                # 로그아웃·비번변경·정지로 끊김
    SESSION_REUSE_DETECTED = "SESSION_REUSE_DETECTED"  # 토큰 유출 감지 → 전체 종료
    SESSION_STORE_UNAVAILABLE = "SESSION_STORE_UNAVAILABLE"  # Redis 장애 (503)

    # ── 계정 ──────────────────────────────────────────────
    USER_NOT_FOUND = "USER_NOT_FOUND"
    ADMIN_NOT_FOUND = "ADMIN_NOT_FOUND"
    USER_DOES_NOT_EXISTS = "USER_DOES_NOT_EXISTS"      # 로그인 실패 (존재/비번을 구분하지 않는다)
    USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS"
    ACCOUNT_DISABLED = "ACCOUNT_DISABLED"

    # ── OAuth ─────────────────────────────────────────────
    OAUTH_TOKEN_FAILED = "OAUTH_TOKEN_FAILED"
    OAUTH_TOKEN_MISSING = "OAUTH_TOKEN_MISSING"
    OAUTH_USERINFO_FAILED = "OAUTH_USERINFO_FAILED"
    OAUTH_EMAIL_REQUIRED = "OAUTH_EMAIL_REQUIRED"

    # ── 외부 호출 ─────────────────────────────────────────
    UPSTREAM_UNREACHABLE = "UPSTREAM_UNREACHABLE"
    UPSTREAM_INVALID_RESPONSE = "UPSTREAM_INVALID_RESPONSE"

    # ── 파일 업로드 ───────────────────────────────────────
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    FILE_TYPE_NOT_ALLOWED = "FILE_TYPE_NOT_ALLOWED"
    FILE_REQUIRED = "FILE_REQUIRED"
