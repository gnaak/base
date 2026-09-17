# Base — FastAPI + React 풀스택 템플릿

새 프로젝트를 시작할 때마다 다시 만들게 되는 것들 — 쿠키 기반 JWT 인증, OAuth 로그인, 계층 구조, 공통 응답 포맷, 로깅, 마이그레이션 —
을 한 번만 제대로 만들어 두고 복사해서 쓰기 위한 템플릿입니다.

`git clone` 후 `.env`만 채우면 **로그인이 동작하는 상태**에서 도메인 기능부터 시작할 수 있습니다.

---

## 1. 이 템플릿은 무엇인가

### 무엇을 해결하는가

- **매번 다시 만드는 인증을 한 번만 만든다** — 쿠키 기반 JWT, refresh 회전, 일반/관리자 이중 세션, Google·Kakao OAuth가 이미 붙어 있음
- **계층을 강제해서 구조가 무너지지 않게 한다** — `router → service → repository` 를 폴더가 아니라 의존성 주입(`ServiceProvider`)으로 고정
- **환경별 설정 실수를 기동 시점에 잡는다** — DB·Redis 연결을 fail-fast로 검증하고, 쿠키 설정이 조용히 깨지는 조합을 경고로 남김
- **프론트·백엔드 인증 계약을 문서가 아니라 타입으로 맞춘다** — 백엔드 `session_info` ↔ 프론트 `UserInfo`가 1:1

### 무엇이 들어있고, 무엇이 없는가

| | 포함 | 미포함 |
|---|---|---|
| **인증** | 로그인/로그아웃/refresh, Google·Kakao OAuth, 이중 세션 | 회원가입 화면·라우트, 비밀번호 재설정, 이메일 인증 |
| **백엔드** | 계층 구조, DI, 공통 응답, 예외 핸들러, 로깅, Alembic | 도메인 로직 (직접 채울 것) |
| **프론트** | 관리자 레이아웃·사이드바, UI 킷(폼/테이블/모달/토스트), 라우트 가드 | 디자인 시스템, 실제 화면 |
| **인프라** | 헬스체크, 요청 ID, CORS·보안 헤더 | Docker, CI, 배포 스크립트 |

### 이 템플릿에서 집중한 것

`chatbot_kt`에서 Kotlin + Spring으로 Layered Architecture를 적용해 본 경험을 FastAPI로 옮긴 것이 출발점입니다.
Spring은 프레임워크가 계층을 강제하지만 FastAPI는 아무것도 강제하지 않아서, **계층을 어떻게 무너지지 않게 유지할 것인가**가 핵심 과제였습니다.

- **`presentation → application → domain` 을 `router → service → repository` 로 옮김** — 라우터는 요청/응답만, 서비스는 로직만, 리포지토리는 쿼리만
- **의존성 주입을 `ServiceProvider` 하나로** — Spring의 DI 컨테이너 대신 lazy property를 모아둔 객체 하나를 라우터에 주입. 서비스가 서비스를 직접 import 하지 않게 됨
- **순환 import를 구조로 회피** — `ServiceProvider`의 모든 import가 함수 안에 있는 이유. 최상단에 두면 `app.module` 로딩 순서에 따라 깨진다
- **계층 횡단 관심사는 데코레이터로** — 인증(`with_login`), DI(`with_provider`)를 라우터 본문 밖으로

---

## 2. 기술 스택

| 계층 | 사용 기술 |
|------|-----------|
| **Frontend** | React 19 + TypeScript + Vite 6 + TanStack Query v5 + Tailwind CSS v3 + React Router v7 |
| **Backend** | FastAPI 0.135 + SQLAlchemy 2.0 (async) + Pydantic v2 |
| **Database** | MySQL 8 (aiomysql) + Alembic |
| **Cache / Session** | Redis 7 |
| **인증** | PyJWT (HS256) + HttpOnly Cookie + Argon2 + OAuth (Google, Kakao) |
| **로깅** | 표준 logging + QueueHandler 비동기 파이프라인 + 요청 ID |

---

## 3. 빠른 시작

### 3.1 사전 준비

- Python 3.11+, Node 20+
- MySQL 8 과 Redis 7 이 로컬에 떠 있을 것 (`backend/.env`의 `local_*` 값과 일치해야 함)
- 빈 데이터베이스 하나 생성 (`CREATE DATABASE db_example;`)

### 3.2 환경 변수

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

최소한 아래는 채워야 기동됩니다.

| 파일 | 키 | 비고 |
|------|----|----|
| `backend/.env` | `local_mysql_*` | 로컬 MySQL 접속 정보 |
| `backend/.env` | `local_redis_host` / `local_redis_port` | 비밀번호가 없으면 `local_redis_password`는 비워둘 것 |
| `backend/.env` | `jwt_secret` / `hash_key` | **프로젝트마다 새로 생성** (아래 참고) |
| `frontend/.env` | `VITE_APP_PUBLIC_BASE_URL` | 백엔드 오리진 |

```bash
# jwt_secret / hash_key 생성
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

OAuth 키를 비워두면 소셜 로그인만 동작하지 않고 서버는 정상 기동합니다.

### 3.3 실행

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
sh migrate.sh "init"        # 테이블 생성
sh run.sh                   # http://localhost:8000  (문서: /docs)

# Frontend
cd frontend
npm install
npm run dev                 # http://localhost:3000
```

> **로컬에서는 프론트와 백엔드 호스트를 반드시 통일할 것** (`localhost`끼리 또는 `127.0.0.1`끼리).
> 섞으면 cross-site가 돼서 `SameSite=Lax` 쿠키가 실리지 않고, **로그인은 200인데 세션이 안 잡히는** 증상이 납니다.

기동 로그에 인식된 환경과 쿠키 설정이 찍히므로 한 번 확인하세요.

```
설정: env=local (근거: 기본값(APP_ENV 미설정)) | db=127.0.0.1:3306/db_example |
      redis=localhost:6379 | cors=['http://localhost:3000', 'http://127.0.0.1:3000'] |
      cookie(domain=host-only, secure=False, samesite=Lax)
✅ DB 연결 확인
✅ Redis 연결 확인
```

---

## 4. 환경 변수

`.env`는 `.gitignore` 대상입니다. 키 목록은 `.env.example`이 유일한 출처이며, 코드에서 실제로 읽는 키만 들어 있습니다.

### 4.1 backend/.env

`app/core/config/settings.py`의 `RawEnv`가 읽습니다. 값은 `{env}_` 접두사로 local / prod 두 벌을 두고 `APP_ENV`가 고릅니다.

| 변수 | 필수 | 용도 |
|------|------|------|
| `mysql_port` | | MySQL 포트 (기본 3306, local/prod 공용) |
| `local_mysql_user` / `_password` / `_host` / `_db` | ✅ | 로컬 MySQL 접속 |
| `prod_mysql_user` / `_password` / `_host` / `_db` | ✅ | 운영 MySQL 접속 (로컬만 돌릴 땐 빈 값 허용) |
| `local_redis_host` / `_port` | ✅ | 로컬 Redis 접속 |
| `local_redis_password` | | 없으면 비워둘 것 |
| `prod_redis_host` / `_port` / `_password` | ✅ | 운영 Redis 접속 |
| `jwt_secret` | ✅ | JWT 서명 키 (HS256) |
| `hash_key` | ✅ | 내부 해시용 키 |
| `openai_api_key` | | 없으면 GPT 기능만 비활성 |
| `kakao_client_id` / `_secret` | | Kakao OAuth |
| `local_kakao_redirect_uri` / `prod_kakao_redirect_uri` | | 카카오 콘솔 등록값과 **정확히** 일치해야 함 |
| `google_client_id` / `_secret` | | Google OAuth |
| `local_google_redirect_uri` / `prod_google_redirect_uri` | | Google 콘솔 등록값과 일치해야 함 |
| `local_domain` / `prod_domain` | ✅ | CORS 오리진 + 쿠키 도메인을 여기서 함께 유도 |

**`{env}_domain` 작성 규칙**

- 쉼표로 여러 개. 스킴(`http`/`https`)은 쓰지 않는다 — env에 따라 자동으로 붙는다 (local→http, prod→https)
- CORS는 포트를 따지므로 `localhost:3000`처럼 포트까지 적는다 (쿠키는 반대로 포트를 구분하지 않음)
- 앞에 점을 찍으면(`.example.com`) 쿠키가 서브도메인까지 공유된다. 점이 없으면 host-only — 범위가 제일 좁아 안전하고 대부분 이게 맞다

### 4.2 frontend/.env

Vite는 `VITE_` 접두사가 붙은 것만 클라이언트에 노출합니다. **여기 적은 값은 전부 번들에 박혀 브라우저에서 보이므로** `client_secret` 류는 넣지 마세요.

| 변수 | 용도 |
|------|------|
| `VITE_APP_PUBLIC_BASE_URL` | 백엔드 오리진 |
| `VITE_APP_PUBLIC_KAKAO_REST_API_KEY` | Kakao REST API 키 (백엔드 `kakao_client_id`와 동일) |
| `VITE_APP_PUBLIC_KAKAO_REDIRECT_URI` | 백엔드 `{env}_kakao_redirect_uri`와 동일 |
| `VITE_APP_PUBLIC_GOOGLE_CLIENT_ID` | 백엔드 `google_client_id`와 동일 |
| `VITE_APP_PUBLIC_GOOGLE_REDIRECT_URI` | 백엔드 `{env}_google_redirect_uri`와 동일 |

`frontend/.env.production`은 `npm run build` 시 `.env` 위에 **키 단위로 덮어씌워집니다.** 운영에서 달라지는 키만 적으면 됩니다.

### 4.3 APP_ENV — 배포 시 반드시 명시

`APP_ENV`는 **`.env`에 적어도 먹지 않습니다.** `settings.py`가 `os.getenv("APP_ENV")`로 읽는데,
pydantic-settings는 `.env`를 `os.environ`에 넣지 않기 때문입니다. 실제 환경변수로 주세요.

```bash
APP_ENV=prod uvicorn app.main:app --host 0.0.0.0 --port 8000
```

| APP_ENV | 인식 | 쿠키 |
|---------|------|------|
| `prod` / `production` | prod | `secure=True`, `SameSite=None` |
| `local` / `development` | local | `secure=False`, `SameSite=Lax` |
| (미설정) | 호스트명이 `ip-`/`ec2-`로 시작하면 prod, 아니면 **local** | 추측 결과에 따름 |

> 이 추측은 EC2 기본 호스트명에서만 맞습니다. Docker·Cloud Run에 올리면 조용히 `local`로 떨어져
> 쿠키가 `secure=False` / `SameSite=Lax`로 나가고 세션이 잡히지 않습니다. 기동 로그의 `env=` 와 경고를 확인하세요.

---

## 5. 프로젝트 구조

### 5.1 백엔드

`core`는 모든 도메인이 공유하는 기반, `module`은 도메인별 구현입니다.
각 도메인은 `router → service → repository` 세 파일을 기본형으로 가집니다.

```
backend/
├── .env.example
├── requirements.txt
├── run.sh                                 # uvicorn --reload (단일 프로세스)
├── migrate.sh                             # 로컬 전용: 리비전 생성 + 적용
├── migrate_server.sh                      # 서버 전용: upgrade head 만
├── alembic/
│   └── versions/                          # 리비전은 로컬에서 만들어 커밋한다
└── app/
    ├── main.py                            # lifespan(연결 검증·정리) + create_app()
    │
    ├── core/                              # 도메인이 공유하는 기반
    │   ├── config/settings.py             # RawEnv + 환경별 파생값(쿠키·CORS·DB URL)
    │   ├── database/
    │   │   ├── base.py                    # async engine, get_session
    │   │   └── redis.py                   # lazy 싱글톤 Redis 클라이언트
    │   ├── provider/                      # 의존성 주입
    │   │   ├── http/
    │   │   │   ├── service.py             # ServiceProvider — lazy property 모음
    │   │   │   ├── endpoint.py            # @with_provider
    │   │   │   └── login.py               # @with_login("user"|"admin") / @without_login
    │   │   └── web_socket/                # WS용 동일 3종
    │   ├── middleware/
    │   │   ├── register.py                # 미들웨어 등록 순서
    │   │   ├── cors.py                    # settings.cors_origins 기반
    │   │   ├── request_id.py              # 요청 ID 발급 + 액세스 로그
    │   │   └── security.py                # 보안 헤더
    │   ├── exception/handler.py           # 예외 → BaseResponse 매핑
    │   ├── logging/                       # QueueHandler 비동기 파이프라인
    │   └── utils/
    │       ├── response.py                # success() / fail() / BaseResponse
    │       └── http_client.py             # 공용 아웃바운드 httpx 클라이언트
    │
    └── module/
        ├── __init__.py                    # setup_routers() — 라우터 등록 한 곳
        ├── auth/
        │   ├── auth_router.py             # /api/auth/**
        │   ├── auth_service.py            # 로그인·로그아웃·refresh
        │   └── auth_token.py              # JWT 생성·검증, 쿠키 4종 심기
        ├── user/                          # user.py(모델) + repository + service + router
        ├── admin/                         # 관리자 계정 (라우터는 비어 있음 — 채울 자리)
        ├── web_socket/                    # WS 연결 관리 (manager.py) + 핸들러
        └── infra/                         # 외부 시스템 연동
            ├── google/google_service.py   # 구글 토큰 교환 → 사용자 조회/생성
            ├── kakao/kakao_service.py
            ├── redis/redis_service.py
            └── gpt/gpt_service.py         # OpenAI 클라이언트 래핑 자리 (빈 껍데기)
```

### 5.2 프론트엔드

`container`는 라우트 단위 페이지, `component`는 페이지가 조합하는 UI 조각입니다.
관리자(`admin`)와 일반 사용자(`client`)는 폴더부터 분리합니다.

```
frontend/
├── .env.example
├── vite.config.ts                         # port 3000, "@" → src 별칭
└── src/
    ├── main.tsx / App.tsx                 # ErrorBoundary + QueryClient + Router + AuthProvider
    │
    ├── container/                         # 페이지
    │   ├── admin/
    │   │   ├── login.tsx                  # /admin/login
    │   │   ├── layout.tsx                 # 관리자 레이아웃 + adminMenu 정의 + 로그인 가드
    │   │   └── main.tsx                   # /admin
    │   ├── client/
    │   │   ├── layout.tsx                 # 사용자 레이아웃
    │   │   ├── main.tsx                   # /
    │   │   └── auth/                      # /google/login, /kakao/login 콜백
    │   └── notfound.tsx
    │
    ├── component/
    │   ├── admin/
    │   │   ├── layout/                    # header, sideBar(groupLink·subLink), login
    │   │   ├── ui/form/                   # button, inputbox, selectBox, comboBox, calendar,
    │   │   │                              #   checkbox, radioButton, toggle, textareaBox
    │   │   ├── ui/feedback/               # modal, formModal, alert, toast
    │   │   ├── ui/table/                  # table, tableHeader, tableBody
    │   │   └── ui/                        # loading, pagination
    │   └── common/errorBoundary.tsx
    │
    ├── context/AuthProvider.tsx           # user/admin 두 세션을 함께 들고 있음
    ├── hooks/
    │   ├── auth/
    │   │   ├── privateRoute.tsx           # 로그인 필요 라우트 가드
    │   │   ├── publicRoute.tsx            # 로그인 상태면 밀어내는 가드
    │   │   ├── googleLogin.tsx / googleCallback.tsx
    │   │   └── kakaoLogin.tsx  / kakaoCallback.tsx
    │   └── common/
    │       ├── useAPI.ts                  # fetch 래퍼 + 401 자동 refresh + 재시도
    │       ├── useAuth.ts                 # AuthContext 소비
    │       └── getCookie.ts               # user_info 파싱, refresh_exp 확인, 쿠키 삭제
    ├── types/                             # user, auth, admin/*
    └── utils/format/                      # date, number, time
```

---

## 6. 백엔드 상세

### 6.1 계층과 의존 방향

```
router      요청/응답만. 비즈니스 로직 금지
  ↓         (@with_provider 로 p: ServiceProvider 주입, @with_login 으로 인증)
service     로직. 다른 서비스가 필요하면 생성자로 받는다
  ↓
repository  쿼리만. SQLAlchemy 세션을 들고 있음
  ↓
model       SQLAlchemy 선언
```

라우터 예시 — 세 줄이 한 세트입니다.

```python
@router.get("/me")
@with_provider
@with_login("user")
async def get_me(p: ServiceProvider):
    return success(await p.user_service.get_me(p.request.user_id))
```

### 6.2 ServiceProvider — 의존성 주입

서비스가 서비스를 직접 import 하면 순환 참조와 테스트 불가가 따라옵니다.
`ServiceProvider`가 lazy property로 전부 들고 있고, 라우터는 `p` 하나만 받습니다.

```python
@property
def user_service(self):
    if not self._user_service:
        from app.module.user.user_service import UserService   # ← 함수 안에서 import
        self._user_service = UserService(self.user_repo)
    return self._user_service
```

> **import가 함수 안에 있는 이유** — `app.module`이 라우터를 통해 이 모듈을 import합니다.
> 최상단에 두면 로딩 순서에 따라 순환 import로 깨집니다. 새 서비스를 추가할 때도 같은 형태를 지키세요.

### 6.3 공통 응답 포맷

모든 응답은 `BaseResponse`로 통일됩니다. 프론트 `useAPI.ts`의 `BaseResponse<T>`와 1:1입니다.

```jsonc
{ "success": true,  "message": "ok",         "data": { }, "errorCode": null }
{ "success": false, "message": "권한이 없습니다", "data": null, "errorCode": "FORBIDDEN" }
```

- 성공: `return success(data)` — `app/core/utils/response.py`
- 실패: `fail("메시지", "ERROR_CODE", 403)` — 어디서든 호출 가능. `HTTPException`을 던지고 전역 핸들러가 변환

### 6.4 로깅

`[시각] [레벨] [req:요청ID] [모듈] 메시지` 형식. 요청 ID는 미들웨어가 발급하고 `contextvar`로 전파됩니다.

**채널이 나뉘어 `backend/logs/`에 쌓입니다.** 서버에 붙어서 볼 때 `error.log`만 보면 되도록.

| 파일 | 내용 |
|------|------|
| `app.log` | 전부 |
| `access.log` | HTTP 요청 중 2xx/3xx만 — 트래픽 확인용 |
| `error.log` | 4xx/5xx 요청 + `ERROR` 이상 — **장애 볼 땐 여기만** |
| `openai.log` | `app.module.infra.gpt` 하위 로거 (app.log에도 동시 기록) |

```bash
tail -f backend/logs/error.log
```

- 자정 로테이션, 14일 보관 (`TimedRotatingFileHandler`)
- `QueueHandler`/`QueueListener`로 비동기 — 파일 I/O가 이벤트 루프를 막지 않음
- 채널을 가르는 건 **핸들러에 달린 필터**입니다. 로거에 핸들러를 직접 붙이지 않으므로
  파일 쓰기가 전부 리스너 스레드에 남아 비동기 구조가 유지됩니다
- 액세스 로그 분기는 미들웨어가 `extra={"status_code": ...}`로 실어 보낸 값을 봅니다 —
  메시지 문자열을 파싱하지 않으므로 로그 포맷을 바꿔도 안 깨집니다
- 헬스체크(`/api/health`)와 `/media/*`는 액세스 로그에서 제외
- 쿼리스트링의 `code`·`token` 등 민감 값은 `***`로 가려서 기록

**도메인별 파일 추가** — `logging/config.py`의 상수 한 줄이면 됩니다.

```python
EXTRA_LOG_CHANNELS: dict[str, str] = {
    "openai":    "app.module.infra.gpt",
    "anthropic": "app.module.infra.claude",   # ← 추가
}
```

> `--workers N`으로 멀티 프로세스 기동하면 파일 로테이션이 충돌합니다.
> 그땐 파일 핸들러 대신 stdout 수집(systemd/docker 로그 드라이버)으로 전환하세요.

### 6.5 마이그레이션

리비전은 **로컬에서 만들어 커밋**하고, 서버는 **적용만** 합니다. 서버에서 autogenerate 하면 히스토리가 갈라집니다.

```bash
# 로컬 — 모델 변경 후
sh migrate.sh "add order table"     # revision --autogenerate + upgrade head
git add backend/alembic/versions/   # 생성된 리비전은 반드시 커밋

# 서버 — 배포 시
git pull && pip install -r requirements.txt
APP_ENV=prod sh migrate_server.sh   # upgrade head 만
```

> 테이블이 이미 있는 DB에 처음 도입할 때는 `alembic stamp head`를 1회 실행하세요.

### 6.6 API

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| `GET` | `/api/health` | — | liveness (LB·컨테이너용) |
| `POST` | `/api/auth/login` | — | 이메일/비밀번호 로그인 → 쿠키 4종 발급. 본문 `type`으로 `user`/`admin` 구분 |
| `POST` | `/api/auth/logout` / `/logout_admin` | — | 쿠키 만료 |
| `POST` | `/api/auth/refresh_token` / `_admin` | refresh 쿠키 | 세션 갱신 |
| `POST` | `/api/auth/google` / `/kakao` | — | OAuth 콜백 코드 → 쿠키 발급 |
| `GET` | `/api/user/me` | user | 내 정보 |
| `WS` | `/api/ws/` | — | WebSocket 연결 |

로그인 요청 본문:

```jsonc
{ "email": "a@b.com", "password": "…", "type": "user" }   // type: "user" | "admin"
```

**라우트가 없는 것** — `AuthService.signup()`은 구현돼 있지만 엔드포인트로 노출돼 있지 않습니다.
`/api/admin`도 라우터만 등록돼 있고 비어 있습니다. 둘 다 프로젝트에 맞춰 채울 자리입니다.

전체 스펙은 서버 기동 후 `http://localhost:8000/docs`.

---

## 7. 인증

### 7.1 쿠키 4종

로그인/refresh 성공 시 백엔드가 내려주는 쿠키입니다. 접두사는 `user_` 또는 `admin_`.

| 쿠키 | httponly | 수명 | 용도 |
|------|----------|------|------|
| `{p}access_token` | ✅ | 1h | API 인증 |
| `{p}refresh_token` | ✅ | 6h | 세션 갱신 |
| `{p}user_info` | ❌ | 1h | 프론트가 읽는 세션 정보 (base64 JSON) |
| `{p}refresh_exp` | ❌ | 6h | "refresh 세션이 살아있다"는 마커 |

- **`user_`와 `admin_`은 완전히 독립된 세션입니다.** 동시에 둘 다 살아있을 수 있습니다
- `user_info`의 필드는 백엔드 `auth_token.create_jwt_token()`의 `session_info`와
  프론트 `types/user.ts`의 `UserInfo`가 **1:1로 일치해야 합니다.** 백엔드에 필드를 추가하면 `UserInfo`도 같이 고칠 것

### 7.2 로그인 → 세션 유지 흐름

```
로그인 (POST /api/auth/login  { email, password, type })
   ↓
백엔드: Argon2 검증 → JWT 발급 → {type}_ 접두사로 쿠키 4종 심기
   ↓
프론트: syncAuth() — user_info 쿠키를 파싱해 Context에 반영
   ↓
   … access_token 만료 (1h) …
   ↓
API 요청 → 401
   ↓
useAPI: refresh 진행 중이 아니면 POST /api/auth/refresh_token
   │      (동시에 401이 여러 개 떠도 네트워크 호출은 타입당 1회)
   ├─ 성공 → 쿠키 재발급 → 원 요청 재시도
   └─ 실패 → clearAuthCookies() 로 user_info·refresh_exp 삭제
             → AuthExpiredError → AuthProvider 상태 비움 → 로그인 페이지
```

### 7.3 무한 새로고침 함정

이 템플릿에서 반복적으로 터졌던 버그입니다. `user_info` 쿠키가 남아 있으면 프론트는 로그인 상태로 믿는데,
토큰이 무효라 API는 401을 줍니다. 이때 **전체 새로고침**을 하면 쿠키가 그대로라 루프가 돕니다.

- 세션 실패 시 **절대 페이지를 새로고침하지 말 것** — `location.reload()` / 같은 URL로 `location.href` 대입 금지
- 상태만 갱신한다: `syncAuth()` / `refreshAuth()`
- refresh가 실패하면 `clearAuthCookies()`로 `user_info`·`refresh_exp`를 지워 로그인 상태를 확실히 해제
- refresh 재시도는 마운트/요청당 1회로 제한 (`refreshTried` ref, `pendingRefresh` 맵)

---

## 8. 프론트엔드 상세

### 8.1 라우팅

```
/                    ClientLayout > ClientMain
/google/login        OAuth 콜백
/kakao/login         OAuth 콜백
/admin/login         AdminLogin      (레이아웃 밖 — 가드에 걸리면 안 되므로)
/admin               AdminLayout > AdminMain
*                    NotFound
```

로그인이 필요한 페이지는 `PrivateRoute`로 감쌉니다.

```tsx
<Route path="/mypage" element={<PrivateRoute><MyPage /></PrivateRoute>} />
```

관리자 영역은 개별 가드 대신 `AdminLayout`이 통째로 가드 역할을 합니다.

### 8.2 useAPI

`fetch` 래퍼 + TanStack Query. 401을 만나면 자동으로 refresh 후 원 요청을 재시도합니다.

- 모든 요청은 `credentials: "include"` — 쿠키 인증이라 필수
- 응답은 `BaseResponse<T>`로 파싱
- refresh는 타입(`user`/`admin`)당 1회만 — 동시에 401이 여러 개 떠도 네트워크 호출은 한 번
- refresh까지 실패하면 `AuthExpiredError`를 던지고 `auth:expired` 이벤트 발행. React Query 재시도 대상에서 제외

### 8.3 관리자 메뉴 추가

메뉴는 `container/admin/layout.tsx`의 `adminMenu` 한 곳에서 정의합니다.
헤더 제목(`routeConfig`)도 여기서 자동 유도되므로 따로 손댈 필요가 없습니다.

```tsx
const adminMenu: AdminMenuItem[] = [
  // 단일 링크
  { type: "link", label: "대시보드", to: "/admin", icon: ChartColumnIcon },

  // 접히는 그룹 — children이 하위 메뉴
  {
    type: "group",
    title: "회원 관리",
    icon: UsersIcon,
    children: [
      { label: "회원 목록", to: "/admin/users", icon: UsersIcon },
      { label: "탈퇴 회원", to: "/admin/users/left", icon: UsersIcon },
    ],
  },
];
```

라우트는 `App.tsx`의 `AdminLayout` 하위에 추가합니다.

---

## 9. 새 프로젝트로 가져갈 때

```bash
git clone https://github.com/gnaak/base.git my-project
cd my-project
rm -rf .git && git init
```

체크리스트:

- [ ] `backend/.env.example` → `backend/.env` 복사 후 값 채우기
- [ ] **`jwt_secret`·`hash_key`를 새로 생성** — 템플릿 값을 그대로 쓰면 다른 프로젝트에서 발급한 토큰이 통과합니다
- [ ] `frontend/.env.example` → `frontend/.env` 복사 후 값 채우기
- [ ] `backend/.env`의 `prod_domain` — 운영 도메인. CORS 오리진과 쿠키 도메인이 여기서 유도됩니다
- [ ] `frontend/.env.production`의 `VITE_APP_PUBLIC_BASE_URL`
- [ ] `container/admin/layout.tsx`의 `adminMenu` 샘플 교체
- [ ] `backend/alembic/versions/` 초기화 여부 결정 (User·Admin 테이블을 그대로 쓸지)
- [ ] OAuth 콘솔에 새 redirect URI 등록
- [ ] 배포 시 `APP_ENV=prod` 명시

Claude Code로 개발한다면 `CLAUDE.md`, `frontend/CLAUDE.md`, `backend/CLAUDE.md`에 규칙이 정리돼 있습니다.

---

## 10. 트러블슈팅

| 상황 | 원인 / 대응 |
|------|------------|
| 로그인은 200인데 세션이 안 잡힘 | 쿠키가 실제로 저장됐는지 DevTools에서 확인. 프론트·백엔드 호스트 불일치(`localhost` ↔ `127.0.0.1`), `{env}_domain` 오타, `APP_ENV` 오인식 순으로 의심 |
| 무한 새로고침 / 401 반복 | §7.3 참고. `user_info` 쿠키가 남아 있는지부터 확인 |
| 배포 후 쿠키가 안 실림 | 기동 로그의 `env=` 확인. `local`로 떨어졌으면 `APP_ENV=prod`를 명시 |
| CORS 차단 | `{env}_domain`에 **포트까지** 적었는지 확인. 스킴은 적지 않음 |
| 기동 즉시 종료 | DB·Redis 연결 검증(fail-fast) 실패. 로그에 원인이 찍힘 |
| `alembic` 히스토리 충돌 | 서버에서 autogenerate 했을 가능성. 리비전은 로컬에서만 생성 |
| 프론트 빌드 시 env 값이 비어 있음 | `.env.production`이 `.env`를 키 단위로 덮어씀. 빌드 머신에 `.env`가 없다면 전부 명시해야 함 |

---

## 11. 상태

혼자 쓰려고 만든 개인 프로젝트 템플릿입니다. Kotlin + Spring으로 Layered Architecture를 적용해 본
[chatbot_kt](https://github.com/gnaak/chatbot_kt)의 계층 구조를 FastAPI로 옮기면서 시작했고,
새 프로젝트를 만들 때마다 부족했던 부분을 되먹여 다듬고 있습니다.

API 키·DB 접속 정보 등 시크릿은 `.env`로 분리되어 있으며 저장소에 포함하지 않습니다.
