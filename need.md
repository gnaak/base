# need.md — 템플릿 보완 목록

이 템플릿을 코드 레벨로 훑고 정리한 개선 목록. **A → B → C 순서로 하나씩 처리한다.**

- **A. 없으면 안 되는 것** — 구조적 결함·보안 구멍. 파생 프로젝트 전부에 복제되므로 여기서 막는다
- **B. 있으면 크게 좋은 것** — 없어도 돌아가지만 매 프로젝트마다 다시 만들게 되는 것
- **C. 정리할 것** — 죽은 코드·중복

각 항목의 `측정` 블록은 실제로 돌려서 얻은 결과다. 다시 확인할 필요 없다.

> 진행 상태는 체크박스로 관리한다. 항목 하나를 끝내면 `CLAUDE.md`의 검증 명령을 돌리고 커밋한다.

---

## 요약

| # | 항목 | 분류 | 예상 |
| --- | --- | --- | --- |
| [A1](#a1-pydantic-스키마가-없다) | ~~Pydantic 스키마 부재 (`with_provider`가 원인)~~ | 구조 | ✅ 완료 |
| [A2](#a2-requestvalidationerror-핸들러가-없다) | ~~`RequestValidationError` 핸들러 없음~~ | 구조 | ✅ 완료 |
| [A3](#a3-success-가-datetimedecimal을-직렬화하지-못한다) | ~~`success()`가 datetime·Decimal 직렬화 못 함~~ | 버그 | ✅ 완료 |
| [A4](#a4-prod에서-csrf가-실제로-뚫린다) | ~~prod CSRF 무방비~~ | 보안 | ✅ 완료 (Origin 검증은 선택) |
| [A5](#a5-로그인-레이트리밋이-없다) | ~~로그인 레이트리밋 없음~~ | 보안 | ✅ 완료 |
| [A6](#a6-토큰-무효화가-불가능하고-active가-검사되지-않는다) | ~~토큰 무효화 불가 + `active` 미검사~~ | 보안/버그 | ✅ 완료 |
| [B7](#b7-docker-compose) | ~~docker-compose (MySQL + Redis)~~ | 인프라 | ✅ 완료 |
| [B8](#b8-ci) | ~~CI (pytest + tsc + build)~~ | 인프라 | ✅ 완료 |
| [B9](#b9-ruff) | ~~ruff (백엔드 린터·포매터)~~ | 품질 | ✅ 완료 |
| [B10](#b10-의존성-관리) | ~~의존성 관리 (uv + pyproject + lock)~~ | 품질 | ✅ 완료 |
| [B11](#b11-프론트-테스트) | ~~프론트 테스트 (vitest)~~ | 품질 | ✅ 완료 |
| [B12](#b12-페이지네이션-계약) | ~~페이지네이션 응답 규약~~ | 기능 | ✅ 완료 |
| [B13](#b13-파일-업로드) | ~~파일 업로드 엔드포인트~~ | 기능 | ✅ 완료 |
| [B14](#b14-timestampmixin) | ~~`TimestampMixin` (updated_at, soft delete)~~ | 기능 | ✅ 완료 |
| [B15](#b15-에러코드-상수화) | ~~에러코드 상수화 (백엔드 + 프론트 타입)~~ | 품질 | ✅ 완료 |
| [B16](#b16-prod-실행-스크립트) | ~~prod 실행 스크립트~~ | 인프라 | ✅ 완료 |

## ✅ A · B · C 전부 완료

| 영역 | 상태 |
| --- | --- |
| 구조 | 요청·응답 양쪽에 타입. `/docs` 가 실제 계약과 일치 |
| 보안 | IP·계정 2층 레이트리밋 / 세션 무효화 + 로테이션 + 재사용 탐지 / `SameSite=Lax` |
| 인프라 | compose(개발) · Dockerfile(배포) · CI(검증) |
| 품질 | ruff · pytest 84 · vitest 8 · 에러코드 상수 |
| 기능 기반 | 페이지네이션 · 파일 업로드 · TimestampMixin |

**남은 선택 항목** (`need.md` 안에 표시):
- A4 의 Origin 검증 미들웨어 — `cookie_samesite=none` 을 써야 하는 배포가 생기면
- `ruff format` 적용 — 27개 파일이 재포맷된다. 별도 커밋으로 하는 게 리뷰하기 좋다
- 앱 Dockerfile 의 프론트 버전(nginx 이미지), 배포 스크립트

---

# A. 없으면 안 되는 것

## A1. Pydantic 스키마가 없다

- [x] **완료** — 데코레이터 제거, `Annotated` 의존성 별칭 도입

**결과**: 모든 라우트가 `operationId=wrapper_*` / `params=None` / `body=False` 였던 것이
정상 명세로 복구됨. 500 이던 잘못된 입력이 전부 422 + `VALIDATION_ERROR`.
기존 테스트 14개는 손대지 않고 통과 (= 외부 계약 불변). 회귀 테스트 15개 추가 → 총 29개.

**바뀐 것**: `endpoint.py`/`login.py`(HTTP·WS 4개 파일) → `deps.py` 2개.
`p.request.user_id` → `p.auth.user_id`. `await request.json()` → 스키마 파라미터.

> 스텁으로 남겨둔 옛 4개 파일은 지워도 된다:
> `rm app/core/provider/{http,web_socket}/{endpoint,login}.py`

### 증상

`app/core/provider/http/endpoint.py:8` 의 `with_provider` 가 `@wraps` 없이 래퍼를 씌워서
함수 시그니처를 `(p)` 하나로 덮어쓴다. FastAPI 는 이 래퍼의 시그니처만 보므로
**선언할 수 있는 파라미터가 `p` 하나뿐**이 된다.

```python
def with_provider(func):
    async def wrapper(p: ServiceProvider = Depends(get_provider)):   # ← 여기
        return await func(p)
    return wrapper
```

### 측정

```
GET /item/{item_id}   operationId='wrapper_item__item_id__get'   params=None   body=False
GET /search           operationId='wrapper_search_get'           params=None   body=False

route.name:  /item/{item_id} → 'wrapper'
             /search         → 'wrapper'
```

path/query 파라미터는 런타임엔 동작하지만(`p.request.path_params`) 문서엔 전혀 안 나온다.

검증이 없으니 잘못된 입력이 전부 500 으로 나간다:

```
broken-json  -> HTTP 500  {"errorCode":"INTERNAL_ERROR"}
empty-body   -> HTTP 500  {"errorCode":"INTERNAL_ERROR"}
json-array   -> HTTP 500  {"errorCode":"INTERNAL_ERROR"}   # body.get() → AttributeError
json-string  -> HTTP 500  {"errorCode":"INTERNAL_ERROR"}
```

### 잃고 있는 것

| 항목 | 현재 상태 |
| --- | --- |
| 입력 검증 | `await request.json()` + `body.get()` — 검증 0 |
| `/docs` | 파라미터·요청 바디가 하나도 안 나옴. README 의 "전체 스펙은 /docs" 는 사실이 아님 |
| 프론트 타입 자동생성 | operationId 가 전부 `wrapper_*` → `openapi-typescript` 사용 불가 |
| `url_for()` | route name 이 전부 `wrapper` |
| 400 vs 500 구분 | 클라이언트 잘못이 `error.log` 를 오염시켜 진짜 장애와 섞임 |

### 고친 방법 (적용됨)

데코레이터를 버리고 **`Annotated` 의존성 별칭**으로 갔다. DI와 인증이 이름 하나로 합쳐지고,
시그니처는 그대로 살아남는다.

```python
# core/provider/http/deps.py — 정의는 한 번, 3줄
Provider      = Annotated[ServiceProvider, Depends(provider())]
UserProvider  = Annotated[ServiceProvider, Depends(provider("user"))]
AdminProvider = Annotated[ServiceProvider, Depends(provider("admin"))]
```

```python
# before — 3줄
@router.get("/me")
@with_provider
@with_login()
async def get_me(p: ServiceProvider):
    return success(await p.user_service.get_me(p.request))

# after — 2줄. 데코레이터보다 짧다
@router.get("/me")
async def get_me(p: UserProvider):
    return success(await p.user_service.get_me(p.auth.user_id))
```

`Annotated[타입, 메타데이터]`가 한 이름에 두 정보를 담는다 — 나/IDE는 `ServiceProvider`를 보고,
FastAPI는 `Depends(provider("user"))`를 본다. **파라미터 하나의 타입일 뿐이라 나머지 파라미터가
그대로 살아있는 것**이 데코레이터와의 결정적 차이다.

부수 효과로 `request.user_id = ...` 처럼 Starlette `Request` 에 임의 속성을 꽂는 것도 사라졌다
(원래 `request.state` 용도다). 이제 `p.auth`는 진짜 dataclass라 자동완성이 뜬다.

> ⚠️ `Annotated[..., Depends(...)]` 는 기본값이 없어서 **기본값 있는 파라미터보다 앞**에 와야 한다.
> `async def list_items(p: UserProvider, page: int = 1)` — 어기면 `SyntaxError` 로 즉시 터진다.

**아직 안 한 것** — `BaseResponse` 제네릭화와 `response_model` 선언은 A3에 묶여 있다.
`success()` 가 `JSONResponse` 를 직접 만들어서 `response_model` 을 선언해도 무시되기 때문.
그래서 지금은 **요청** 스키마만 `/docs` 에 뜨고 응답 스키마는 아직 없다.

### 작업 범위 (완료)

- `app/core/provider/http/deps.py` — 신규. `endpoint.py` + `login.py` 대체
- `app/core/provider/web_socket/deps.py` — 신규. 동일 구조 (`WSProvider` 3종)
- 옛 4개 파일은 "새 위치 안내 + `ImportError`" 스텁으로 남겨둠 — 지워도 된다
- `app/core/utils/response.py` — `BaseResponse` 제네릭화
- `app/module/*/[domain]_router.py` — 전부 (엔드포인트 8개)
- `app/module/auth/auth_service.py`, `infra/google`, `infra/kakao` — `request.json()` 대신 스키마 인자
- 신규: `app/module/[domain]/[domain]_schema.py`
- 문서: `backend/CLAUDE.md` 라우터 패턴, `README.md` §6.1, `.claude/agents/be-api-builder.md`
- 테스트: `tests/test_user_router.py` 는 그대로 통과해야 함 (외부 계약은 안 변함)

---

## A2. `RequestValidationError` 핸들러가 없다

- [x] **완료** — `handler.py`에 `validation_handler` 추가 (A1과 함께)

### 증상

`app/core/exception/handler.py` 의 `setup_exceptions()` 가 `HTTPException` 과 `Exception` 만 등록한다.
A1 을 고쳐 스키마를 붙이는 순간 검증 실패가 `BaseResponse` 계약을 깨고 나간다.

### 측정

```
422 {"detail":[{"type":"missing","loc":["body","password"],"msg":"Field required",...}]}
```

프론트 `usePost` 는 `errorData?.message` 가 `undefined` 라 **"Something went wrong"** 만 띄운다.

### 고치는 법

```python
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(x) for x in first.get("loc", [])[1:])
    body = BaseResponse(
        success=False,
        message=f"{field}: {first.get('msg', '입력값이 올바르지 않습니다')}",
        data=None,
        errorCode="VALIDATION_ERROR",
    )
    return JSONResponse(status_code=422, content=jsonable_encoder(body))
```

프론트에서 `errorCode === "VALIDATION_ERROR"` 로 분기할 수 있게 상수도 같이 추가한다 (B15).

### 작업 범위

- `app/core/exception/handler.py`
- `frontend/src/types/` — 에러코드 상수
- 테스트: 검증 실패 응답도 `BaseResponse` 형태인지 확인하는 케이스 추가

---

## A3. `success()` 가 datetime·Decimal 을 직렬화하지 못한다

- [x] **완료** — 2층으로 처리했다

**1층** — `success()` 가 `JSONResponse` 대신 **`BaseResponse` 모델**을 반환한다.
예외 핸들러는 `jsonable_encoder` 를 쓴다. datetime·Decimal·date·UUID·Enum 500이 사라졌다.

**2층** — `BaseResponse` 를 제네릭으로 바꾸고 라우터마다 `response_model=BaseResponse[XxxOut]`
을 걸었다. **문서화뿐 아니라 강제가 목적이다** — 측정해보니 `JSONResponse` 를 반환하면
`response_model` 은 `/docs` 에 뜨기만 하고 실제 응답을 검사하지 않아서,
스키마에 없는 `password` 가 그대로 새어나갔다. 모델을 반환하면 잘린다.

**쿠키** — `response: Response` 를 파라미터로 주입받아 해결. `create_jwt_token()` 은 고치지 않았고,
대신 **`SessionOut` 을 반환**하게 해서 쿠키와 응답 `data` 가 같은 객체에서 나오도록 했다
(`test_응답_data와_user_info_쿠키가_같은_내용이다` 가 이 계약을 고정).

**곁다리로 고친 것** — 프론트 `types/admin/login.ts` 의 `LoginResponse` 가
`{code, message}` 였는데 백엔드가 그런 걸 준 적이 없다. `UserInfo` 로 교체.

테스트 29 → **34개**.

### 증상

`app/core/utils/response.py:26` 이 `JSONResponse(content=body.model_dump())` 라 `json.dumps` 를 그대로 탄다.

### 측정

```
datetime  FAIL TypeError: Object of type datetime is not JSON serializable
Decimal   FAIL TypeError: Object of type Decimal is not JSON serializable
date      FAIL TypeError: Object of type date is not JSON serializable
plain     OK   {"success":true,"message":"ok","data":{"id":1,"name":"ok"},"errorCode":null}
```

`app/module/user/user_service.py:30` 이 `.isoformat()` 을 손으로 부르는 이유가 이것이다.
현재 주석은 "필드를 골라 담아라" 로만 설명돼 있는데, **실제로는 안 하면 500 이 난다.**
도메인을 추가할 때마다 반복되고, 금액(`Decimal`)을 다루면 바로 터진다.

### 고치는 법

```python
from fastapi.encoders import jsonable_encoder

return JSONResponse(status_code=status_code, content=jsonable_encoder(body))
```

한 줄이다. 고친 뒤 `user_service.get_me()` 의 수동 `.isoformat()` 도 제거할 수 있다
(필드를 골라 담는 것 자체는 password 노출 방지라 **유지**할 것 — 회귀 테스트가 있다).

### 작업 범위

- `app/core/utils/response.py`
- 테스트: `success()` 에 datetime 을 담아도 200 이 나가는지 케이스 추가

---

## A4. prod 에서 CSRF 가 실제로 뚫린다

- [x] **완료** — `SameSite`를 `.env`로 빼고 기본을 `lax`로 바꿨다
- [ ] (선택) 상태 변경 메서드에 Origin 검증 미들웨어 — `none`을 써야만 하는 배포용

**핵심은 "방어를 만드는 것"이 아니라 "스스로 끈 방어를 다시 켜는 것"이었다.**
브라우저에는 이미 `SameSite=Lax`라는 기본 방어가 있는데, prod에서 무조건 `None`으로
덮어쓰고 있었다. 그게 CSRF를 가능하게 만든 유일한 원인이다.

게다가 이 템플릿은 프론트 JS가 `user_info` 쿠키를 읽어야 해서 **원래 same-site를 전제**한다
(`backend/CLAUDE.md`에 그렇게 적혀 있다). `None`은 자기 아키텍처와 모순이었다.

- 모르는 값을 적으면 **조용히 뚫리지 않도록** `Lax`로 떨어지고 기동 로그에 경고
- `none`을 켜면 "CSRF 기본 방어가 꺼진다" 경고, `secure=False`와 조합되면 "브라우저가
  쿠키를 거부한다" 경고까지 (그 조합은 로그인이 아예 안 잡힌다)

**`none`이 진짜 필요한 경우** — Vercel + 별도 API 도메인, 서드파티 iframe 임베드.
그때는 위 체크박스의 Origin 검증이나 CSRF 토큰을 같이 붙여야 한다.
`Starlette`의 `request.json()`은 Content-Type을 확인하지 않아서 `text/plain`으로 보내면
preflight 없이 통과하므로, **CORS만으로는 못 막는다.**

> 임베드 위젯에 로그인이 필요해지면 `SameSite=none`으로 전면 전환하지 말 것.
> iframe URL·`postMessage`로 별도 토큰을 넘기거나 CHIPS(`Partitioned` 쿠키)를 쓰는 게 맞다 —
> 최상위 사이트별로 쿠키 저장소가 분리돼서 CSRF에 쓰이지 않는다.

테스트 63 → **72개**.

### 증상

prod 쿠키가 `SameSite=None; Secure` (`app/core/config/settings.py:252`) 이고 인증이 쿠키 단독이다.
CSRF 토큰도 Origin 검증도 없다.

"CORS 가 막아주지 않나?" 싶지만 **막히지 않는다:**

1. `Content-Type: text/plain` 으로 보내면 preflight 가 붙지 않는 simple request 가 된다
2. Starlette 의 `request.json()` 은 **Content-Type 을 확인하지 않고** 바디를 그냥 파싱한다
3. `SameSite=None` 이라 쿠키가 그대로 실린다

```js
// 공격자 페이지에서
fetch("https://api.example.com/api/…", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "text/plain" },   // ← preflight 없음
  body: '{"...":"..."}',
});
```

응답은 못 읽지만 **상태 변경 API 는 실행된다.** 바디 없는 POST(`/logout`, `/refresh_token`)는 더 쉽다.

### 고치는 법 (택1 이상)

1. **`SameSite=Lax` 로 전환** — README 가 이미 "프론트·백엔드가 등록 도메인을 공유해야 한다" 고
   못박고 있으므로 대부분의 배포에서 `Lax` 로 충분하다. 진짜 cross-site 일 때만 `.env` 플래그로
   `None` 을 열어준다. **가장 깔끔.**
2. **Origin/Referer 검증 미들웨어** — 상태 변경 메서드(POST/PATCH/PUT/DELETE)에만 적용.
   `settings.cors_origins` 를 그대로 재사용하면 된다
3. **double-submit CSRF 토큰** — 위 둘로 부족할 때

1 + 2 조합을 권장한다.

### 작업 범위

- `app/core/config/settings.py` — `cookie_samesite` 를 `.env` 로 제어 가능하게
- `app/core/middleware/` — `csrf.py` 신규 (Origin 검증)
- `app/core/middleware/register.py` — 등록
- `backend/.env.example`, `README.md` §4.3 / §7, `CLAUDE.md` 인증 계약

---

## A5. 로그인 레이트리밋이 없다

- [x] **완료** — `core/utils/rate_limit.py` 신규. 두 층으로 넣었다.

| 층 | 키 | 기본값 | 막는 것 |
| -- | -- | ------ | ------- |
| IP × 엔드포인트 | IP + 묶음 | 로그인 10/분 | 한 IP의 폭주 |
| 계정 × 실패 | 이메일 | 5회/10분 | IP를 바꿔가며 한 계정을 두드리는 공격 |

**두 번째가 핵심이다.** 앞단(nginx·Cloudflare)은 IP 기준이라 분산 크리덴셜 스터핑을
구조적으로 못 막는다 — 그게 앱에 레이트리밋을 두는 이유다. nginx가 이미 있어도 둘 다 필요하다.

**미들웨어가 아니라 의존성**으로 만들었다. 미들웨어는 규칙에 경로 문자열을 적어야 해서
라우터 prefix를 바꾸면 제한이 **조용히** 풀린다.

참고한 선행 구현에서 네 가지를 다르게 만들었다:

1. 429가 CORS 헤더 없이 나가던 문제 — `fail()`을 쓰면 전역 핸들러를 타서 자동 해결
2. preflight `OPTIONS`가 한도를 깎던 문제 — 세지 않는다
3. `BaseHTTPMiddleware` → 의존성 (그쪽 `security.py`에 "StreamingResponse + downstream
   `request.json()` 조합에서 deadlock"이라고 적어두고 rate_limit만 안 고쳐져 있었다)
4. 429가 `BaseResponse` 계약을 안 지키던 문제 — `errorCode` + `Retry-After` 추가

추가로 `X-Forwarded-For`를 **peer가 공인 IP가 아닐 때만** 믿도록 했다 (앱이 직접 노출돼
있으면 헤더 위조로 한도를 우회할 수 있다). 테스트 34 → **50개**.

### 증상

`app/module/auth/auth_router.py:12` 의 `/api/auth/login` 이 무제한이다.
Argon2 라 크레덴셜 스터핑은 느리지만, 그게 역으로 **CPU 고갈 DoS** 가 된다 (Argon2 는 의도적으로 무겁다).

### 고치는 법

Redis 와 `RedisService` 가 이미 있다. IP + 이메일 조합 키로 카운터 하나면 된다.

```python
# app/module/auth/auth_service.py
async def login(self, body, request, redis):
    key = f"login:fail:{request.client.host}:{body.email}"
    if await redis.get_int(key) >= 5:
        fail("로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.", "TOO_MANY_ATTEMPTS", 429)
    ...
    # 실패 시 incr + expire(600), 성공 시 delete
```

OAuth 콜백(`/google`, `/kakao`)과 `/refresh_token` 에도 같은 장치를 붙일지 판단할 것.

### 작업 범위

- `app/module/infra/redis/redis_service.py` — 카운터 헬퍼
- `app/module/auth/auth_service.py`
- 테스트: 6회 실패 후 429 가 나가는지 (fakeredis 로 돌아감)

---

## A6. 토큰 무효화가 불가능하고 `active` 가 검사되지 않는다

- [x] **완료** — `module/auth/auth_revoke.py` 신규. 로테이션·재사용 탐지까지 넣었다.

| 수단 | 범위 | 언제 |
| ---- | ---- | ---- |
| 거부 목록(jti) | 그 세션 하나 | 로그아웃 |
| 버전 카운터(ver) | 그 계정의 모든 세션 | 비번 변경·계정 정지·"모든 기기에서 로그아웃" |
| 로테이션 | 방금 쓴 refresh | 갱신할 때마다 자동 |
| 재사용 탐지 | 그 계정의 모든 세션 | 죽은 refresh가 또 오면 (유출로 판단) |

**확인은 refresh 시점에만** 한다. 매 요청마다 하면 Redis 왕복이 요청마다 생긴다.
대신 access를 짧게 가져가 지연을 묶는다 — **무효화 지연 = `access_token_minutes`(기본 30분)**.
이게 "access 15~30분" 권고의 근거다.

`active` 검사는 **`create_jwt_token()` 한 곳**에 뒀다. 세션을 발급하는 유일한 지점이라
로그인·OAuth·refresh가 전부 여기를 지나고, 새 로그인 경로를 추가해도 자동으로 걸린다.

**로테이션 유예(10초)가 핵심이다.** 탭을 여러 개 열면 각자 refresh를 시도하는데
(프론트 `pendingRefresh`는 탭 *안에서만* 중복을 막는다), 유예가 없으면 이 정상 동작이
재사용으로 오판돼 사용자가 통째로 로그아웃된다. 유예 마커를 거부 목록보다 **먼저** 쓰는 이유도
같다 — 순서가 반대면 그 사이에 들어온 동시 요청이 오판된다.

덕분에 `refresh_token_hours` 기본값을 12 → **168(7일)** 로 올렸다. 2주는 336.

**fail 방향이 두 갈래다** — 레이트리밋은 fail-open(가용성 우선), 무효화는 fail-closed(보안 우선).
단 **토큰 발급 시의 버전 조회만 fail-open**이다. 그건 보안 검사가 아니라 도장 찍기라,
Redis가 죽었다고 로그인까지 막을 이유가 없다. 이 구분은 테스트를 쓰다가 발견했다
(`test_Redis가_죽어도_로그인은_된다`가 처음엔 503으로 깨졌다).

테스트 50 → **63개**.

### 증상 1 — 무효화 불가

`AuthToken.delete_token()` 은 **쿠키만 지운다.** 탈취된 `refresh_token` 은 발급 후 6시간 동안
그대로 유효하다. 로그아웃해도, 비밀번호를 바꿔도 막을 수 없다.

### 증상 2 — `active` 미검사

`app/module/user/user.py:14` 에 `active` 컬럼이 있는데
`app/module/auth/auth_service.py:39` 의 `login()` 이 검사하지 않는다.
**정지·탈퇴 처리한 유저가 그대로 로그인된다.** 컬럼만 있고 로직이 없다.

### 고치는 법

`active` 는 `login()` 과 `get_or_create_user()` 양쪽에서 검사한다 (OAuth 경로로 우회 가능하므로).

무효화는 Redis 로:

- **유저별 `token_version` 카운터** — JWT payload 에 `ver` 를 싣고, 검증 시 Redis 값과 비교.
  로그아웃·비밀번호 변경·정지 시 `incr`. 구현이 단순하고 "이 유저의 모든 세션 끊기" 가 공짜
- 또는 **`jti` 블랙리스트** — 개별 토큰 단위로 끊어야 할 때

전자를 권장한다.

### 작업 범위

- `app/module/auth/auth_token.py` — payload 에 `ver`, 검증에 비교 추가
- `app/module/auth/auth_service.py` — `active` 검사, 로그아웃 시 `incr`
- `app/module/user/user_repository.py` — `get_or_create_user` 에 `active` 검사
- `app/module/infra/redis/redis_service.py`
- 테스트: 정지 유저 로그인 401, 로그아웃 후 기존 토큰 401

---

# B. 있으면 크게 좋은 것

## B7. docker-compose

- [x] **완료** — 루트 `docker-compose.yml` + `docker/mysql/init.sql`

MySQL 8 + Redis 7 만 띄운다. **앱은 컨테이너에 넣지 않았다** — 로컬에서 `sh run.sh` /
`npm run dev` 로 띄우는 게 이 템플릿의 개발 흐름이고, 여기는 매번 새로 까는 게 귀찮은 것만 담는다.

- `db_example` + `db_base_test` 를 init 스크립트로 자동 생성 (utf8mb4_unicode_ci)
- 값이 `backend/.env.example` 의 `local_*` 기본값과 **정확히 일치** — `.env` 복사만 하면 붙는다
- `127.0.0.1` 에만 바인딩 (root 비밀번호가 비어 있으므로 네트워크에 열면 안 된다)
- `--default-time-zone=+09:00` — 이 템플릿이 KST 벽시계로 저장하는 것과 맞춤
- healthcheck 는 `mysqladmin ping -h 127.0.0.1` (TCP). 소켓 ping 을 쓰면 초기화 중
  임시 서버가 응답해서 `init.sql` 이 끝나기 전에 healthy 로 잡힌다 — B8(CI)에서
  `service_healthy` 로 기다릴 때 중요하다
- 포트 충돌 대비: `MYSQL_PORT` / `REDIS_PORT` 로 바꿀 수 있다 (루트 `.env`)

**검증 상태** — `docker compose config` 통과, 포트 오버라이드 동작 확인.
**실제 기동은 확인하지 못했다** (작업 환경에서 Docker Desktop 엔진이 꺼져 있었고,
3306·6379 는 네이티브 MySQL·Redis 가 점유 중이었다). 처음 쓸 때 `docker compose ps` 로
둘 다 `healthy` 인지, `pytest` 가 통과하는지 확인할 것.

## B8. CI

- [x] **완료** — `.github/workflows/ci.yml` (job 3개) + `backend/Dockerfile`

| job | 하는 일 |
| --- | ------- |
| `backend` | MySQL·Redis 서비스 컨테이너 + `pytest` (Python 3.12 고정) |
| `frontend` | `check:types` · `lint` · `build` |
| `docker` | `backend/Dockerfile` 빌드 — 배포 직전에야 깨진 걸 아는 상황 방지 |

서비스 컨테이너는 B7 의 compose 와 **같은 이미지·같은 healthcheck** 를 쓴다
(`mysqladmin ping -h 127.0.0.1` 로 TCP 확인해야 초기화 완료를 제대로 기다린다).

**배포용 Dockerfile 도 같이 만들었다.** "파이썬 버전을 고정하고 싶다" 는 요구는
개발 컨테이너가 아니라 여기서 푸는 게 맞다 — `python:3.12-slim` 고정, 멀티스테이지,
비루트 실행, `APP_ENV=prod` 를 이미지에 박아 단골 사고를 막는다.
`.env` 는 `.dockerignore` 로 제외하고 운영 값은 주입받는다.

> 개발에는 이 이미지를 쓰지 않는다. 핫리로드에 필요한 바인드 마운트가 Windows 의
> `C:\...` 에서는 느리고 `inotify` 가 안 넘어온다. Docker 는 **인프라 + 배포**에만.

**lint 를 CI 에 넣으려고 테이블 컴포넌트의 `any` 6개를 제네릭으로 고쳤다** —
`Table`/`TableBody` 가 `Row` 제네릭을 받고, 헤더는 `render` 를 뺀 `HeaderColumn` 을 받는다
(변성 문제 회피). 템플릿의 `any` 는 복사해 쓰는 프로젝트마다 그대로 번진다.

**검증 상태** — YAML 파싱·job 구조 확인, `pytest`/`lint`/`build` 로컬 통과,
`.env` 뒤 키가 이기는지 확인(CI 의 시크릿 주입이 여기 의존).
**GitHub Actions 실제 실행과 Docker 이미지 빌드는 확인하지 못했다** (Docker 엔진 꺼져 있음).
첫 푸시 후 Actions 탭에서 확인할 것.

## B9. ruff

- [ ] 처리

백엔드에 린터·포매터가 없다. `isort` 가 `requirements.txt` 에 있지만 설정도 없고 쓰이지도 않는다.
ruff 하나가 lint + format + isort 를 전부 대체한다. `isort` 는 제거.

## B10. 의존성 관리

- [x] **완료** — 1차: `requirements-dev.txt` 분리 / 2차: **uv 전환**

처음엔 `requirements.txt`(운영) / `requirements-dev.txt`(개발) 두 갈래로 나눴다.
당시 `pyproject.toml` 로 안 간 이유는 "pyproject 는 lock 이 아니라서 freeze 보다
재현성이 낮다" 였는데, **uv 를 쓰면 그 전제가 무너진다** — `uv.lock` 이 플랫폼별
해시까지 들고 있어서 freeze 보다 재현성이 높고, 파이썬 인터프리터 버전까지 고정된다.

최종 상태:

| 파일 | 역할 |
|------|------|
| `pyproject.toml` | 의존성 선언 + ruff + pytest. 사람이 고치는 건 여기뿐 |
| `uv.lock` | 해석 결과. 커밋한다 |
| `.python-version` | `3.12`. uv 가 없으면 받아온다 |

- 그룹 3개 — 기본(운영) / `dev`(pytest·fakeredis·ruff) / `prod`(gunicorn)
- CI·Docker·서버는 전부 `--frozen` → 배포 때 버전이 조용히 오르지 않는다
- **덤으로 잡힌 것**: `deploy/fastapi.service` 가 gunicorn 을 실행하는데 gunicorn 이
  어디에도 선언돼 있지 않았다. 그 유닛 그대로 쓰면 기동 실패한다. `prod` 그룹으로 편입
- 전환하면서 의존성이 전부 최신으로 올라갔다 (redis 7.3→8.1, starlette 1.0→1.6,
  uvicorn 0.42→0.53, pydantic 2.12→2.13). 84개 테스트 + ruff 통과로 확인

## B11. 프론트 테스트

- [ ] 처리

프론트 테스트가 0 이다. vitest + testing-library 를 붙이고 **`useAPI.ts` 의 401 → refresh 경로**부터 덮는다.
`CLAUDE.md` 가 "이 템플릿에서 반복적으로 터졌던 버그" 라고 명시한 바로 그 지점인데 테스트가 없다.

- 401 → refresh 성공 → 원 요청 재시도
- 401 → refresh 실패 → 쿠키 삭제 + `AuthExpiredError`
- 동시 401 여러 개 → refresh 네트워크 호출 1회
- 새로고침이 일어나지 않는지

## B12. 페이지네이션 계약

- [ ] 처리

프론트엔 `component/admin/ui/pagination.tsx` 가 있는데 백엔드에 대응하는 응답 규약이 없다.
목록 API 는 모든 프로젝트에 나온다.

```python
class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
```

repository 에 `paginate()` 헬퍼, 프론트에 대응 타입까지 한 세트로.

## B13. 파일 업로드

- [ ] 처리

`main.py` 가 `/media` 를 mount 만 하고 업로드 엔드포인트가 없다.
프론트 `usePost<FormData>` 는 준비돼 있는데 받는 쪽이 없다.

- 확장자 화이트리스트, 용량 제한, 파일명 새로 생성(경로 조작 방지)
- 저장 경로는 `settings.MEDIA_ROOT`

## B14. TimestampMixin

- [ ] 처리

`updated_at` 과 soft delete 가 없어서 도메인마다 반복된다. `core/database/base.py` 에 믹스인 하나.

```python
class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=now_kst)
    updated_at = Column(DateTime(timezone=True), default=now_kst, onupdate=now_kst)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
```

기존 `User`·`Admin` 에 적용하면 마이그레이션이 필요하다 — 템플릿 초기화 시점에 같이 할 것.

## B15. 에러코드 상수화

- [ ] 처리

`"USER_NOT_FOUND"` 같은 리터럴이 백엔드에 흩어져 있고 프론트엔 타입이 없다.
프론트가 `errorCode` 로 분기하라고 문서에 써 놓고 비교할 상수를 주지 않는다.

- 백엔드: `app/core/utils/error_code.py` (또는 `StrEnum`)
- 프론트: `src/types/errorCode.ts` — 백엔드와 1:1 (인증 계약과 같은 방식)

## B16. prod 실행 스크립트

- [ ] 처리

`run.sh` 가 `uvicorn --reload` 뿐이다. 배포 명령은 README 한 줄로만 존재한다.
`APP_ENV=prod` 누락이 제일 흔한 사고인데 스크립트로 못 박으면 사라진다.

```sh
# run_server.sh
APP_ENV=prod uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> `--workers N` 을 쓰면 파일 로그 로테이션이 충돌한다 (`core/logging/config.py` 주석 참고).
> 멀티 프로세스로 갈 거면 stdout 수집으로 전환하는 것까지 같이 결정할 것.

---

# C. 정리할 것 — ✅ 완료

- [x] `frontend/package.json` — `dompurify` / `highlight.js` / `lowlight` 제거 (사용처 0).
      `npm uninstall` 로 lock 파일까지 정리
- [x] `backend/app/core/database/base.py` — `parse_date()`, `register_base()` 제거 (참조 0).
      `register_base()` 가 하던 설명은 `Base` 위 주석으로 옮김
- [x] `backend/app/module/auth/auth_service.py` — `signup()` 을 **라우트로 노출**했다.
      `POST /api/auth/signup` (201, `SIGNUP_LIMIT` 5회/분). 지우는 대신 살린 이유는
      `SignupIn` 스키마와 `SIGNUP_LIMIT` 이 이미 있는데 아무도 쓰지 않고 있었기 때문.
      세션은 만들지 않는다 — 자동 로그인은 프로젝트마다 다른 선택이라 주석으로만 안내
- [x] `backend/app/module/admin/admin_router.py` — A1 때 정리됨 (채우는 법을 주석으로)
- [x] **라우트 가드 중복** — `App.tsx` 에서 `<PrivateRoute authType="admin">` 으로 감싸고
      `AdminLayout` 의 인라인 가드(useAuth·refreshTried·navigate)를 걷어냈다.
      **AdminLayout 은 이제 인증을 모른다.** 약 25줄 감소
- [x] `backend/requirements.txt` — `isort` 제거 (설정도 사용처도 없었다)

테스트 72 → **76개** (signup 4개 추가).

---

## 참고 — 판단 근거

A1 은 리팩터링이라기보다 **되돌리기**에 가깝다.
Spring 에서 넘어오면서 "계층을 데코레이터로 강제해야 한다" 고 판단한 흔적인데,
FastAPI 에서는 `Depends` 가 이미 그 역할을 하고 스키마까지 함께 준다.

데코레이터가 준 것은 라우터 시그니처가 짧아 보이는 것 하나이고,
대가로 입력 검증 · API 문서 · 프론트 타입 생성을 전부 냈다. 교환비가 맞지 않는다.
