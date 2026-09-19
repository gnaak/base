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
│   │   ├── http/ (service.py: ServiceProvider·Auth · deps.py: Provider 3종)
│   │   └── web_socket/ (동일 구성)
│   └── utils/                      # response.py: success()/fail() · http_client.py: 공용 아웃바운드 HTTP
└── module/
    ├── __init__.py                  # 모델 import + setup_routers()
    ├── auth/ user/ admin/ web_socket/
    └── infra/ (google/ kakao/ redis/ gpt/)
```

## 도메인 모듈 — 5파일 세트

```
module/[domain]/
├── [domain].py             # SQLAlchemy 모델
├── [domain]_schema.py      # 요청 스키마 (Pydantic) — 입력이 있는 도메인만
├── [domain]_repository.py  # DB 쿼리만 (비즈니스 로직 없음)
├── [domain]_service.py     # 비즈니스 로직
└── [domain]_router.py      # HTTP 엔드포인트
```

새 모듈 추가 시 `module/__init__.py`에서:

1. 모델 import (`from app.module.x.x import XModel`) — Base.metadata 등록용
2. `setup_routers()`에 라우터 등록 (`app.include_router(x_router.router, prefix="/api/x")`)

> `alembic/env.py`는 `import app.module` 한 줄로 모든 모델 자동 감지. **별도 수정 불필요.**

## 마이그레이션 — 리비전은 로컬에서만 만든다

- **로컬**: 모델 변경 후 `sh migrate.sh "메시지"` — 리비전 생성 + 로컬 DB 적용.
  생성된 `alembic/versions/*.py`는 **반드시 커밋**한다 (서버가 이 파일로 upgrade한다)
- **서버**: 배포 시 `sh migrate_server.sh` (= `alembic upgrade head`)만 실행.
  **autogenerate 금지** — 환경마다 히스토리가 갈라진다
- 기존에 다른 방식으로 스키마를 만든 서버 DB에 처음 도입할 때는, 스키마가 모델과 일치하는지
  확인한 뒤 `alembic stamp head`를 1회 실행해 기준점을 맞춘다 (안 하면 upgrade가 처음부터 다시 돈다)

## infra 모듈 — service만 (모델·라우터 없음)

| 모듈                           | 역할                               |
| ------------------------------ | ---------------------------------- |
| `infra/gpt/`                   | OpenAI SDK 래핑 (스트리밍, 오디오) |
| `infra/google/` `infra/kakao/` | OAuth 호출                         |
| `infra/redis/`                 | Redis 전용 repository              |

## 라우터 패턴

**데코레이터는 없다.** DI와 인증은 파라미터 타입 하나로 끝난다.

```python
from app.core.provider.http.deps import Provider, UserProvider, AdminProvider
from app.core.utils.response import success, fail
from app.module.example.example_schema import ExampleIn

@router.post("/example")
async def example(body: ExampleIn, p: Provider):        # 로그인 불필요
    return success(await p.example_service.do_something(body))

@router.get("/me")
async def get_me(p: UserProvider):                      # user 로그인 필요
    return success(await p.user_service.get_me(p.auth.user_id))

@router.delete("/group/{group_id}/member/{member_id}")
async def remove(group_id: int, member_id: int, p: AdminProvider):   # 관리자 전용
    await p.group_service.remove_member(group_id, member_id)
    return success(message="removed")
```

| 타입             | 의미                                     |
| ---------------- | ---------------------------------------- |
| `Provider`       | 비로그인. `p.auth`는 `None`              |
| `UserProvider`   | user 토큰 필수                           |
| `AdminProvider`  | admin 토큰 필수                          |

**로그인 정보는 `p.auth`에서 읽는다** (`p.request.user_id` 아님 — 그건 예전 방식):

| 값               | 내용                         |
| ---------------- | ---------------------------- |
| `p.auth.user_id` | `int` — access_token의 `sub` |
| `p.auth.auth_type` | `"user"` \| `"admin"`      |

**path/query/body는 그냥 파라미터로 선언한다.** FastAPI가 파싱·검증·문서화를 전부 한다 —
`p.request.path_params[...]`나 `await p.request.json()`을 쓰지 말 것. 쓰면 검증이 사라지고
잘못된 입력이 422가 아니라 500으로 나간다.

```python
# ❌ 예전 방식 — 검증 없음, /docs에 안 나옴, int() 실패 시 500
async def get_item(p: UserProvider):
    item_id = int(p.request.path_params["item_id"])
    body = await p.request.json()

# ✅
async def get_item(item_id: int, body: ItemIn, p: UserProvider):
```

> ⚠️ `Provider` 계열은 기본값이 없으므로 **기본값 있는 파라미터보다 앞**에 온다.
> `async def list_items(p: UserProvider, page: int = 1)` — 순서를 어기면 `SyntaxError`로 바로 터진다.

**응답 헬퍼**

- `success(data)` → `JSONResponse`로 `{success:true, message, data, errorCode:null}` 반환
- `fail("msg", "ERROR_CODE", 400)` → HTTPException을 **raise** (return 아님). 전역 핸들러가 `{success:false, message, errorCode}`로 변환

**에러를 낼 땐 반드시 `fail()`을 쓸 것.** 맨 `HTTPException`을 던지면 `errorCode`가
`"HTTP_ERROR"`로 뭉개져서 프론트가 에러 종류로 분기할 수 없다.
`message`는 사람이 읽는 문장, `errorCode`는 프론트가 비교하는 상수로 나눈다.
- 쿠키를 심어야 하면 `success()`가 돌려준 응답 객체에 `set_cookie` — `auth_router.login` 참고

- 요청 스키마 검증 실패는 전역 핸들러가 `422` + `errorCode: "VALIDATION_ERROR"`로 변환한다.
  메시지는 `"email: Field required"` 형태

WebSocket은 `web_socket/deps.py`의 `WSProvider` / `UserWSProvider` / `AdminWSProvider` 사용:

```python
@router.websocket("/")
async def stt_ws(websocket: WebSocket, p: WSProvider):
    await p.web_socket_service.init_state(websocket)
```

> `deps.py`의 `provider()`는 `AuthToken`을 **함수 안에서** import한다.
> `app/module/__init__.py`가 라우터를 통해 이 모듈을 끌어오기 때문에, 최상단에 두면
> 이 모듈을 `app.module`보다 먼저 import했을 때 순환 import로 깨진다. 그대로 둘 것.

## 인증 / 쿠키

`module/auth/auth_token.py`가 전담. 접두사는 `user_` 또는 `admin_`이고, 두 세션은 완전히 독립적이다.

| 쿠키               | httponly | 수명 | 용도                                  |
| ------------------ | -------- | ---- | ------------------------------------- |
| `{p}access_token`  | ✅       | 1h   | API 인증                              |
| `{p}refresh_token` | ✅       | 6h   | 세션 갱신                             |
| `{p}user_info`     | ❌       | 1h   | 프론트가 읽는 세션 정보 (base64 JSON) |
| `{p}refresh_exp`   | ❌       | 6h   | "refresh 세션이 살아있다"는 마커      |

- `create_jwt_token(user, response, type)` — 4종을 한 번에 심는다
- `delete_token(response, type)` — 4종을 한 번에 지운다. **쿠키 하나만 지우면 프론트가 상태를 잘못 판단한다**
- `verify_refresh_by_type(request, type)` — refresh 검증. `(user_id, auth_type)` 반환
- 인증 실패는 전부 `fail()`로 나가므로 `errorCode`에 `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`,
  `INVALID_TOKEN_TYPE`, `REFRESH_TOKEN_MISSING` 같은 상수가 실린다
- `last_login_at`은 **user만** 갱신한다 (`tb_admins`에는 컬럼이 없다).
  일반 로그인은 `auth_service.login()`, OAuth는 `user_repo.get_or_create_user()`가 처리
- JWT payload의 `user` 필드가 요청한 `auth_type`과 다르면 401 — user 토큰으로 admin API 접근 불가

**`user_info`의 `session_info` 필드를 바꾸면 프론트 `types/user.ts`의 `UserInfo`도 같이 고칠 것.** 1:1로 맞춰져 있다.

**환경별 쿠키 속성** — 전부 `settings`에서 온다. `auth_token.py`에 하드코딩된 값은 없다.

|            | local                            | prod   |
| ---------- | -------------------------------- | ------ |
| `secure`   | `False`                          | `True` |
| `samesite` | `Lax`                            | `None` |
| `domain`   | `.env`의 `{env}_domain`에서 유도 | 〃     |

> ⚠️ 실제 서비스 도메인과 맞지 않는 `domain` 값이 나가면 브라우저가 쿠키를 **전부 거부한다.**
> 로그인은 200이 뜨는데 세션이 안 잡혀서 로그인 화면이 무한 반복되는 증상이 난다.

## 도메인 설정 — `{local|prod}_domain` 하나로 관리

CORS 허용 오리진과 쿠키 도메인은 **같은 값에서 유도된다.** `.env`에는 도메인만 적는다.

```bash
local_domain=localhost:3000,127.0.0.1:3000
prod_domain=gnaak.com
```

- **스킴을 쓰지 않는다.** env에 따라 자동으로 붙는다 (local→`http`, prod→`https`)
- **포트는 CORS에만 반영된다.** 쿠키는 포트를 구분하지 않기 때문 —
  로컬에서 프론트 `:3000` / 백엔드 `:8000`이 CORS는 필요하지만 쿠키는 그냥 공유되는 이유가 이것
- **앞에 점을 찍으면**(`.gnaak.com`) 쿠키를 그 도메인과 **모든 서브도메인**에 공유한다.
  점이 없으면 host-only — 범위가 제일 좁아 안전하고, 대부분 이게 맞다
- `localhost`와 IP에는 domain 속성을 붙이지 않는다 (브라우저가 거부하거나 무시한다)

| 배포 형태                                       | `prod_domain`              | 결과                                         |
| ----------------------------------------------- | -------------------------- | -------------------------------------------- |
| 같은 호스트 (`gnaak.com` + `gnaak.com/api`)     | `gnaak.com`                | cors `https://gnaak.com`, 쿠키 host-only     |
| 서브도메인 분리 (`gnaak.com` + `api.gnaak.com`) | `.gnaak.com,api.gnaak.com` | cors 2개, 쿠키 `gnaak.com` (서브도메인 공유) |

> 프론트와 백엔드가 **등록 도메인을 공유해야 한다.** 이 템플릿의 인증은 프론트 JS가 `user_info`
> 쿠키를 직접 읽는 구조라, 완전히 다른 도메인(예: Vercel + 별도 API 도메인)에서는 읽을 수가 없다.

**환경 판정** — `settings.env`는 `APP_ENV` 환경변수로 정해진다 (`prod`/`production` → prod,
`local`/`development` → local). 없으면 호스트명(`ip-`, `ec2-`)으로 추측하고, 그것도 아니면 local.
기동 시 `settings.describe()`가 인식된 env와 판단 근거를 로그로 남기고,
`settings.config_warnings()`가 위험한 조합(추측으로 잡힌 prod, 빈 CORS 등)을 경고한다.

## ServiceProvider — lazy-load 프로퍼티

새 서비스를 붙일 때 `core/provider/http/service.py`에서 **두 군데**를 고쳐야 한다
(`deps.py`는 건드릴 필요 없다):

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

## 테스트 — 라우터 하나 끝나면 바로

```bash
cd backend && .venv/Scripts/python.exe -m pytest        # 전체
.venv/Scripts/python.exe -m pytest tests/test_user_router.py -v   # 한 파일
```

**사전 준비 1회**: `CREATE DATABASE db_base_test;` — `.env`의 `test_mysql_db`와 같은 이름.

- 테스트는 **전용 DB만** 쓴다. 접속 정보는 `local_*`을 쓰되 DB 이름만 `test_mysql_db`로 바꾼다
  (`settings.test_database_url`). `APP_ENV=prod` 셸에서 pytest를 돌려도 운영 DB에 붙지 않는다 —
  테이블을 drop 하므로 이 보호가 필요하다
- 테스트 하나당 트랜잭션 하나. 끝나면 롤백된다. 앱 코드가 `commit()`을 불러도
  SAVEPOINT로 잡히므로 (`join_transaction_mode="create_savepoint"`) 데이터가 남지 않는다
- Redis는 fakeredis로 대체된다. 실제 Redis가 없어도 테스트는 돈다
- **인증은 목킹하지 않는다.** `auth_header(user_id)`가 진짜 JWT를 발급해
  `auth_token.py`의 검증 경로를 그대로 탄다
- 요청은 `client.get(url, headers=auth_header(id))`. `cookies=` 인자는 쓰지 말 것 —
  httpx에서 deprecated고 테스트 간에 쿠키가 샌다
- 새 라우터 테스트는 `tests/test_user_router.py`를 본보기로. 정상 경로 하나로 끝내지 말고
  인증·입력·상태·응답규약 엣지 케이스를 붙인다 (`.claude/agents/be-test-writer.md`에 목록)
- 테스트가 앱 버그를 잡으면 **테스트를 느슨하게 고치지 말고 앱을 고친다**

## 기타

- 시간은 `core/database/base.py`의 `now_kst()` 사용 (tz-aware, Asia/Seoul).
  시간 컬럼은 `DateTime(timezone=True)`로 통일한다 (MySQL은 오프셋을 저장하지 않으므로 실제로는 KST 벽시계 값)
- 비밀번호 해싱은 `auth_service.py`의 `hash_password()` / `verify_password()` (argon2)
- CORS 허용 오리진은 `.env`의 `{local|prod}_domain`에서 유도된다 (위 "도메인 설정" 참고)
- Redis 연결은 `core/database/redis.py`의 `get_redis()` 하나를 공유한다.
  `RedisService`도 이걸 쓴다 — 클라이언트를 따로 만들지 말 것 (password를 빠뜨리기 쉽다)
- 외부 HTTP 호출은 `core/utils/http_client.py`의 `request_json()`을 쓴다 —
  `httpx.AsyncClient`를 직접 만들지 말 것. 타임아웃·아웃바운드 로깅·에러→`fail()` 변환·쿠키 격리가
  전부 여기에 있다 (공유 클라이언트는 lifespan이 열고 닫는다)
- 무인증 헬스체크는 `GET /api/health` — 도메인이 아니라서 `main.py`에 직접 선언되어 있다.
  경로 상수는 `middleware/request_id.py`의 `HEALTH_PATH` (액세스 로그 제외 대상과 공유)
- 로그는 콘솔과 `backend/logs/app.log`(자정 로테이션, 14일 보관)에 함께 남는다 — `core/logging/config.py`.
  액세스 로그(latency 포함)는 `middleware/request_id.py`가 남기고, uvicorn 기본 액세스 로그는 꺼져 있다
- 보안 헤더는 `middleware/security.py`. HSTS는 prod에서만 붙는다
