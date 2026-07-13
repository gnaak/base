# Backend — CLAUDE.md

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
    ├── __init__.py                  # 모델 import + register_routers()
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
2. 라우터 등록 (`app.include_router(x_router.router, prefix="/api/x")`)

> `alembic/env.py`는 `import app.module` 한 줄로 모든 모델 자동 감지. **별도 수정 불필요.**

## infra 모듈 — service만 (모델·라우터 없음)

| 모듈 | 역할 |
|------|------|
| `infra/gpt/` | OpenAI SDK 래핑 (스트리밍, 오디오) |
| `infra/google/` `infra/kakao/` | OAuth 호출 |
| `infra/redis/` | Redis 전용 repository |

## 라우터 패턴

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
@with_login()                           # 로그인 필요, p.user 사용 가능. 괄호 필수!
async def get_me(p: ServiceProvider):   # 관리자 전용은 @with_login("admin")
    return success(p.user)
```

- `success(data)` → `{success:true, data}` 응답
- `fail("msg")` → HTTPException을 **raise** (return 아님). 전역 핸들러가 `{success:false, message}`로 변환
- WebSocket은 `with_provider_web_socket` / `with_login_web_socket` 사용

## ServiceProvider — lazy-load 프로퍼티

`core/provider/http/service.py`에 추가:
```python
@property
def my_service(self):
    if not self._my_service:
        from app.module.my_domain.my_service import MyService
        self._my_service = MyService(self.my_repository)
    return self._my_service
```

## Repository 패턴

```python
class ExampleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_by_id(self, id: int) -> Example | None:
        result = await self.db.execute(select(Example).where(Example.id == id))
        return result.scalar_one_or_none()
```
