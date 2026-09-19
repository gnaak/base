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
├── [domain]_schema.py      # 요청·응답 스키마 (Pydantic). `XxxIn` / `XxxOut`
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

- `success(data)` → `BaseResponse` **모델**을 반환 (JSONResponse 아님)
- `fail("msg", "ERROR_CODE", 400)` → HTTPException을 **raise** (return 아님). 전역 핸들러가 `{success:false, message, errorCode}`로 변환

**응답도 스키마로 고정한다.** 라우터에 `response_model=BaseResponse[XxxOut]`을 걸면
`/docs`에 뜨는 것에 더해 **FastAPI가 실제 응답을 그 스키마로 강제한다** — 스키마에 없는 필드는
잘려 나간다. `password` 유출을 사람이 아니라 타입이 막는 구조다.

```python
@router.get("/me", response_model=BaseResponse[UserOut])
async def get_me(p: UserProvider):
    return success(await p.user_service.get_me(p.auth.user_id))
```

```python
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)   # 모델을 그대로 넘길 수 있게
    id: int
    created_at: datetime | None = None                # datetime을 그냥 담는다
```

- **`JSONResponse`를 직접 반환하지 말 것.** 반환하면 FastAPI가 손을 대지 않고 그대로 내보내서,
  선언한 `response_model`과 실제 응답이 달라도 아무도 잡지 못한다
- `datetime`·`Decimal`·`UUID`·`Enum`은 FastAPI가 알아서 직렬화한다. **손으로 `.isoformat()`을 부르지 말 것**
- 상태코드는 `@router.post("/x", status_code=201)` — `success()`에는 인자가 없다
- 쿠키·헤더를 심어야 하면 **`response: Response`를 파라미터로 주입받는다** (`auth_router.login` 참고).
  거기 심은 것을 FastAPI가 최종 응답에 합쳐준다

**에러를 낼 땐 반드시 `fail()`을 쓸 것.** 맨 `HTTPException`을 던지면 `errorCode`가
`"HTTP_ERROR"`로 뭉개져서 프론트가 에러 종류로 분기할 수 없다.
`message`는 사람이 읽는 문장, `errorCode`는 프론트가 비교하는 상수로 나눈다.
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

## 요청 빈도 제한 — `core/utils/rate_limit.py`

두 층이다. 둘 다 Redis에 카운터를 둔다(워커를 늘려도 한도가 곱해지지 않는다).

```python
from app.core.utils.rate_limit import LOGIN_LIMIT

@router.post("/login", dependencies=[LOGIN_LIMIT], response_model=...)
```

| 층 | 키 | 기본값 | 막는 것 |
| -- | -- | ------ | ------- |
| IP × 엔드포인트 (`rate_limit()`) | IP + 묶음 이름 | 로그인 10/분 | 한 IP의 폭주 |
| 계정 × 실패 (`check_login_attempts()`) | 이메일 | 5회/10분 | **IP를 바꿔가며 한 계정을 두드리는 공격** |

두 번째가 핵심이다 — nginx·Cloudflare가 **구조적으로 못 하는 것**이라 앱에서만 막을 수 있다.
`auth_service.login()`이 비밀번호를 검사하기 **전에** 확인한다 (잠긴 계정에 argon2 비용을 쓰지 않는다).

**어디에 걸 것인가** — 전부 거는 게 아니다. 정상 사용 빈도가 엔드포인트마다 달라 한도를 하나로 못 잡는다.

| 성격 | 걸까 |
| ---- | ---- |
| 로그인·OAuth·비번 재설정 | ✅ 필수 — 시도만으로 정답 여부를 알 수 있다 |
| 회원가입·문의·신고 | ✅ 스팸 |
| 외부 API/LLM 호출, 파일 업로드 | ✅ 돈·자원 |
| 인증이 걸린 일반 읽기/쓰기 | ❌ 로그인이 이미 관문. 폭주는 앞단(nginx) 몫 |
| 헬스체크 | ❌ LB가 계속 때린다 |

- **미들웨어가 아니라 의존성이다.** 미들웨어로 하면 규칙에 경로 문자열을 적어야 하는데,
  라우터 prefix를 바꾸면 제한이 **조용히** 풀린다
- 429는 `fail()`로 나가므로 `errorCode: "TOO_MANY_REQUESTS"` + `Retry-After` 헤더가 붙고,
  전역 핸들러를 타서 CORS 헤더도 정상적으로 실린다
- preflight(`OPTIONS`)는 세지 않는다 — 안 그러면 cross-origin 클라이언트의 실질 한도가 절반이 된다
- **Redis가 죽으면 통과시킨다(fail-open).** 제한이 잠시 풀리는 것보다 모든 로그인이 막히는 쪽이 나쁘다
- ⚠️ `X-Forwarded-For`·`CF-Connecting-IP`는 **직접 연결된 상대가 공인 IP가 아닐 때만** 믿는다.
  앱 포트가 외부에 그대로 열려 있으면 헤더를 위조해 한도를 우회할 수 있기 때문이다.
  nginx를 같은 호스트에 두면(peer=127.0.0.1) 자연히 통과한다

## 인증 / 쿠키

`module/auth/auth_token.py`가 전담. 접두사는 `user_` 또는 `admin_`이고, 두 세션은 완전히 독립적이다.

| 쿠키               | httponly | 수명      | 용도                                  |
| ------------------ | -------- | --------- | ------------------------------------- |
| `{p}access_token`  | ✅       | access    | API 인증                              |
| `{p}refresh_token` | ✅       | refresh   | 세션 갱신                             |
| `{p}user_info`     | ❌       | access    | 프론트가 읽는 세션 정보 (base64 JSON) |
| `{p}refresh_exp`   | ❌       | refresh   | "refresh 세션이 살아있다"는 마커      |

수명은 `.env`의 `access_token_minutes`(기본 30) / `refresh_token_hours`(기본 12)에서 온다.
**`access_token_minutes`는 무효화가 적용되기까지의 최대 지연**이기도 하다 (아래 참고).

- `create_jwt_token(user, response, type)` — 4종을 한 번에 심고 **`SessionOut`을 반환한다**.
  `{p}user_info` 쿠키에 담기는 것과 **같은 객체**라, 라우터가 이걸 응답 `data`에 그대로 실으면
  쿠키와 응답이 어긋날 수가 없다 (`test_응답_data와_user_info_쿠키가_같은_내용이다`가 고정)
- `delete_token(response, type)` — 4종을 한 번에 지운다. **쿠키 하나만 지우면 프론트가 상태를 잘못 판단한다**
- `revoke_current_session(request, type)` — 로그아웃. 쿠키 삭제만으로는 토큰이 만료까지 살아있다
- `verify_refresh_by_type(request, type)` — refresh 검증. `(user_id, auth_type)` 반환
- 인증 실패는 전부 `fail()`로 나가므로 `errorCode`에 `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`,
  `INVALID_TOKEN_TYPE`, `REFRESH_TOKEN_MISSING` 같은 상수가 실린다
- `last_login_at`은 **user만** 갱신한다 (`tb_admins`에는 컬럼이 없다).
  일반 로그인은 `auth_service.login()`, OAuth는 `user_repo.get_or_create_user()`가 처리
- JWT payload의 `user` 필드가 요청한 `auth_type`과 다르면 401 — user 토큰으로 admin API 접근 불가

**`user_info`의 `session_info` 필드를 바꾸면 프론트 `types/user.ts`의 `UserInfo`도 같이 고칠 것.** 1:1로 맞춰져 있다.

## 세션 무효화 — `module/auth/auth_revoke.py`

JWT는 stateless라 발급하고 나면 만료 전까지 스스로 유효하다. "로그아웃했다",
"비밀번호를 바꿨다", "계정을 정지시켰다"를 토큰만으로는 반영할 수 없어서 Redis에 상태를 둔다.

| 수단                             | 범위                  | 언제                                          |
| -------------------------------- | --------------------- | --------------------------------------------- |
| 거부 목록 (`deny_token`, jti)    | 그 세션 하나          | 로그아웃 — 다른 기기는 살아있어야 한다        |
| 버전 카운터 (`revoke_all_sessions`) | 그 계정의 **모든** 세션 | 비밀번호 변경, 계정 정지, "모든 기기에서 로그아웃" |

```python
from app.module.auth.auth_revoke import revoke_all_sessions

await revoke_all_sessions(user.id, "user")   # 비밀번호 변경 후 등
```

- **확인 시점은 refresh 뿐이다.** 매 요청마다 확인하면 Redis 왕복이 요청마다 생긴다.
  대신 access 토큰을 짧게 가져가 지연을 그 값으로 묶는다 — **무효화 지연 = `access_token_minutes`**
- **Redis가 죽으면 거부한다(fail-closed).** 레이트리밋이 fail-open인 것과 반대다 —
  거기는 가용성, 여기는 보안이 우선이다. 단 **토큰 발급 시의 버전 조회는 fail-open**이다
  (그건 보안 검사가 아니라 도장 찍기라, 못 찍었다고 로그인을 막을 이유가 없다)
- `active=False` 검사는 **`create_jwt_token()` 한 곳**에 있다. 세션을 발급하는 유일한 지점이라
  로그인·OAuth·refresh가 전부 여기를 지난다. 새 로그인 경로를 추가해도 자동으로 걸린다

### 로테이션 + 재사용 탐지

refresh를 쓸 때마다 **옛 토큰이 죽는다**(`rotate_refresh()`). 그래서 훔친 토큰은
정상 사용자가 한 번만 갱신해도 무력화된다. 덕분에 `refresh_token_hours`를 며칠 단위로
잡아도 된다 (기본 168 = 7일).

**죽은 토큰이 또 오면 유출로 보고 그 계정의 모든 세션을 끊는다** (`SESSION_REUSE_DETECTED`).
공격자가 정상 사용자보다 먼저 갱신해 간 경우를 잡는 장치다.

- ⚠️ **유예(`ROTATION_GRACE_SECONDS`, 10초)가 핵심이다.** 탭을 여러 개 열어두면 각자
  refresh를 시도하는데(프론트 `pendingRefresh` 맵은 탭 *안에서만* 중복을 막는다),
  유예가 없으면 이 정상 동작이 재사용으로 오판돼 사용자가 통째로 로그아웃된다.
  대가는 유예 시간 동안 훔친 토큰도 한 번 더 통한다는 것
- `rotate_token()`은 **유예 마커를 거부 목록보다 먼저 쓴다.** 순서가 반대면 두 마커
  사이의 짧은 순간에 들어온 동시 요청이 재사용으로 오판된다
- 거부 사유를 구분한다 — 로그아웃(`logout`)된 토큰이 다시 오는 건 흔한 일이라
  전체 세션까지 끊지 않는다. 재사용 탐지는 로테이션(`rotated`)된 토큰에만 적용된다

**환경별 쿠키 속성** — 전부 `settings`에서 온다. `auth_token.py`에 하드코딩된 값은 없다.

|            | local                            | prod   |
| ---------- | -------------------------------- | ------ |
| `secure`   | `False`                          | `True` |
| `samesite` | `.env`의 `cookie_samesite` (기본 `lax`) | 〃 |
| `domain`   | `.env`의 `{env}_domain`에서 유도 | 〃     |

**`SameSite=Lax`가 곧 CSRF 방어다.** 브라우저가 cross-site 요청에 쿠키를 붙이지 않으므로,
악성 사이트가 사용자의 브라우저를 시켜 이 API를 호출해도 인증이 안 된다.

`none`은 그 방어를 **끄는** 값이다. 프론트·백엔드가 다른 사이트일 때만 쓴다
(Vercel + 별도 API 도메인, 서드파티 iframe 임베드 등). 이 템플릿은 프론트 JS가
`user_info` 쿠키를 읽어야 해서 원래 same-site를 전제하므로 대부분 `lax`로 충분하다.
모르는 값을 적으면 조용히 뚫리지 않도록 `Lax`로 떨어지고 기동 로그에 경고가 뜬다.

> ⚠️ `none`으로 여는 순간 CSRF 토큰이나 Origin 검증을 따로 붙여야 한다.
> `Starlette`의 `request.json()`은 Content-Type을 확인하지 않으므로,
> `text/plain`으로 보내면 preflight 없이 통과한다 — CORS만으로는 못 막는다.

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
