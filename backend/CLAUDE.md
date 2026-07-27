# Backend — CLAUDE.md

FastAPI + SQLAlchemy 2.0 (async) + MySQL(aiomysql) + Redis + Alembic

## 폴더 구조

```
app/
├── main.py
├── core/
│   ├── config/settings.py          # 환경변수 (local_/prod_ 접두사로 환경별 분리)
│   ├── database/ (base.py, redis.py)
│   ├── exception/handler.py        # 전역 예외 핸들러
│   ├── logging/                    # 로깅 설정·컨텍스트 (request_id 연동)
│   ├── middleware/ (cors.py, register.py, request_id.py, security.py)
│   ├── provider/
│   │   ├── http/ (endpoint.py, login.py, service.py)
│   │   └── web_socket/ (동일 구성)
│   └── utils/response.py           # success() / fail()
└── module/
    ├── __init__.py                  # 모델 import + setup_routers()
    ├── auth/ user/ admin/ web_socket/
    └── infra/ (google/ kakao/ redis/ gpt/)
```

## 도메인 모듈 — 4파일 세트

```
module/[domain]/
├── [domain].py             # SQLAlchemy 모델
├── [domain]_repository.py  # DB 쿼리만 (비즈니스 로직 없음)
├── [domain]_service.py     # 비즈니스 로직
└── [domain]_router.py      # HTTP 엔드포인트
```

새 모듈 추가 시 `module/__init__.py`에서:
1. 모델 import (`from app.module.x.x import XModel`) — Base.metadata 등록용
2. `setup_routers()`에 라우터 등록 (`app.include_router(x_router.router, prefix="/api/x")`)

> `alembic/env.py`는 `import app.module` 한 줄로 모든 모델 자동 감지. **별도 수정 불필요.**

## infra 모듈 — service만 (모델·라우터 없음)

| 모듈 | 역할 |
|------|------|
| `infra/gpt/` | OpenAI SDK 래핑 (스트리밍, 오디오) |
| `infra/google/` `infra/kakao/` | OAuth 호출 |
| `infra/redis/` | Redis 전용 repository |

## 라우터 패턴

**데코레이터 순서가 중요하다.** `@with_provider`가 항상 `@with_login()` 위에 와야 한다 —
`with_login`은 첫 인자로 `ServiceProvider`를 받는데, 그걸 주입하는 게 `with_provider`이기 때문.

```python
from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login
from app.core.utils.response import success, fail

@router.post("/example")
@with_provider                          # 로그인 불필요
async def example(p: ServiceProvider):
    result = await p.example_service.do_something(p.request)
    return success(result)

@router.get("/me")
@with_provider                          # ← 필수. 빼면 p가 주입되지 않는다
@with_login()                           # 로그인 필요. 괄호 필수!
async def get_me(p: ServiceProvider):   # 관리자 전용은 @with_login("admin")
    user = await p.user_service.get_user_by_id(p.request.user_id)
    return success(user)
```

**`with_login`이 채워주는 값** — `p.user`가 아니라 `p.request`에 붙는다:

| 값 | 내용 |
|----|------|
| `p.request.user_id` | `int` — access_token의 `sub` |
| `p.request.auth_type` | `"user"` \| `"admin"` |

`@without_login`을 쓰면 비로그인 상태로 `user_id="guest_user"`, `auth_type="guest"`가 세팅된다.

**응답 헬퍼**
- `success(data)` → `JSONResponse`로 `{success:true, message, data, errorCode:null}` 반환
- `fail("msg", "ERROR_CODE", 400)` → HTTPException을 **raise** (return 아님). 전역 핸들러가 `{success:false, message, errorCode}`로 변환
- 쿠키를 심어야 하면 `success()`가 돌려준 응답 객체에 `set_cookie` — `auth_router.login` 참고

WebSocket은 `with_provider_web_socket` / `with_login_web_socket` 사용.

## 인증 / 쿠키

`module/auth/auth_token.py`가 전담. 접두사는 `user_` 또는 `admin_`이고, 두 세션은 완전히 독립적이다.

| 쿠키 | httponly | 수명 | 용도 |
|------|----------|------|------|
| `{p}access_token` | ✅ | 1h | API 인증 |
| `{p}refresh_token` | ✅ | 6h | 세션 갱신 |
| `{p}user_info` | ❌ | 1h | 프론트가 읽는 세션 정보 (base64 JSON) |
| `{p}refresh_exp` | ❌ | 6h | "refresh 세션이 살아있다"는 마커 |

- `create_jwt_token(user, response, type)` — 4종을 한 번에 심는다
- `delete_token(response, type)` — 4종을 한 번에 지운다. **쿠키 하나만 지우면 프론트가 상태를 잘못 판단한다**
- `verify_refresh_by_type(request, type)` — refresh 검증. `(user_id, auth_type)` 반환
- JWT payload의 `user` 필드가 요청한 `auth_type`과 다르면 401 — user 토큰으로 admin API 접근 불가

**`user_info`의 `session_info` 필드를 바꾸면 프론트 `types/user.ts`의 `UserInfo`도 같이 고칠 것.** 1:1로 맞춰져 있다.

**환경별 쿠키 속성** (`settings.env`는 `"local"` 또는 `"prod"`):

| | local | prod |
|---|---|---|
| `secure` | `False` | `True` |
| `samesite` | `Lax` | `None` |
| `domain` | `None` | `"none.net"` ← **플레이스홀더. 반드시 교체** |

> ⚠️ `domain`을 안 고치고 prod로 배포하면 브라우저가 쿠키를 전부 거부한다.
> 로그인은 200이 뜨는데 세션이 안 잡혀서 로그인 화면이 무한 반복되는 증상이 난다.

## ServiceProvider — lazy-load 프로퍼티

`core/provider/http/service.py`에서 **두 군데**를 고쳐야 한다:

```python
class ServiceProvider:
    def __init__(self, request: Request, db):
        ...
        self._my_service = None          # 1) __init__에 캐시 슬롯 추가

    @property                            # 2) 프로퍼티 추가
    def my_service(self):
        if not self._my_service:
            from app.module.my_domain.my_service import MyService
            self._my_service = MyService(self.my_repo)
        return self._my_service
```

import은 반드시 프로퍼티 **안에서** (순환 import 방지). repository 네이밍은 `_repo` 접미사.

## Repository 패턴

```python
class ExampleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_by_id(self, id: int) -> Example | None:
        result = await self.db.execute(select(Example).where(Example.id == id))
        return result.scalar_one_or_none()
```

## 기타

- 시간은 `core/database/base.py`의 `now_kst()` 사용 (tz-aware, Asia/Seoul)
- 비밀번호 해싱은 `auth_service.py`의 `hash_password()` / `verify_password()` (argon2)
- CORS 허용 오리진은 `core/middleware/cors.py`에 하드코딩되어 있다 — 배포 전 교체
