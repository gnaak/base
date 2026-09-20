# Base — FastAPI + React 풀스택 템플릿

새 프로젝트를 시작할 때마다 다시 만들게 되는 것들 — 쿠키 기반 JWT 인증, OAuth 로그인, 계층 구조, 공통 응답 포맷, 로깅, 마이그레이션 —
을 한 번만 제대로 만들어 두고 복사해서 쓰기 위한 템플릿입니다.

`git clone` 후 `.env`만 채우면 **로그인이 동작하는 상태**에서 도메인 기능부터 시작할 수 있습니다.

---

## 1. 이 템플릿은 무엇인가

### 무엇을 해결하는가

- **매번 다시 만드는 인증을 한 번만 만든다** — 쿠키 기반 JWT, refresh 로테이션·재사용 탐지, 세션 무효화, 일반/관리자 이중 세션, Google·Kakao OAuth가 이미 붙어 있음
- **계층을 강제해서 구조가 무너지지 않게 한다** — `router → service → repository` 를 폴더가 아니라 의존성 주입(`ServiceProvider`)으로 고정
- **환경별 설정 실수를 기동 시점에 잡는다** — DB·Redis 연결을 fail-fast로 검증하고, 쿠키 설정이 조용히 깨지는 조합을 경고로 남김
- **프론트·백엔드 인증 계약을 문서가 아니라 타입으로 맞춘다** — 백엔드 `session_info` ↔ 프론트 `UserInfo`가 1:1

### 무엇이 들어있고, 무엇이 없는가

| | 포함 | 미포함 |
|---|---|---|
| **인증** | 로그인/로그아웃/refresh, refresh 로테이션 + 재사용 탐지, 세션 무효화, 계정 비활성화, 회원가입, Google·Kakao OAuth, 이중 세션 | 회원가입 **화면**, 비밀번호 재설정, 이메일 인증 |
| **백엔드** | 계층 구조, DI, 공통 응답·에러코드, 예외 핸들러, 로깅, Alembic, 페이지네이션, 파일 업로드, ruff | 도메인 로직 (직접 채울 것) |
| **테스트** | pytest 84개 + vitest 8개, 픽스처 일습 | E2E |
| **프론트** | 디자인 시스템(라이트/다크 토큰, Geist·Pretendard), 관리자 레이아웃·사이드바·대시보드, UI 킷(폼/테이블/모달/토스트/지표/스켈레톤), 라우트 가드, vitest | 도메인 화면 |
| **인프라** | 헬스체크, 요청 ID, CORS·보안 헤더, 레이트리밋, docker-compose(MySQL·Redis), 배포용 Dockerfile, nginx·systemd 설정, GitHub Actions CI | 프론트 Dockerfile, 무중단 배포, SSR/프리렌더(레시피만 문서화) |

### 이 템플릿에서 집중한 것

`chatbot_kt`에서 Kotlin + Spring으로 Layered Architecture를 적용해 본 경험을 FastAPI로 옮긴 것이 출발점입니다.
Spring은 프레임워크가 계층을 강제하지만 FastAPI는 아무것도 강제하지 않아서, **계층을 어떻게 무너지지 않게 유지할 것인가**가 핵심 과제였습니다.

- **`presentation → application → domain` 을 `router → service → repository` 로 옮김** — 라우터는 요청/응답만, 서비스는 로직만, 리포지토리는 쿼리만
- **의존성 주입을 `ServiceProvider` 하나로** — Spring의 DI 컨테이너 대신 lazy property를 모아둔 객체 하나를 라우터에 주입. 서비스가 서비스를 직접 import 하지 않게 됨
- **순환 import를 구조로 회피** — `ServiceProvider`의 모든 import가 함수 안에 있는 이유. 최상단에 두면 `app.module` 로딩 순서에 따라 깨진다
- **계층 횡단 관심사는 타입으로** — DI와 인증을 `p: UserProvider` 같은 파라미터 타입 하나에 실어 라우터 본문 밖으로 뺍니다.
  처음에는 이걸 데코레이터(`@with_provider` / `@with_login`)로 했는데, 데코레이터가 엔드포인트 함수를
  `(p)` 하나짜리 래퍼로 감싸는 바람에 FastAPI가 path·query·body를 볼 수 없었습니다 —
  `/docs`가 비고 입력 검증이 통째로 사라지는 대가였습니다. `Annotated` 의존성으로 바꿔서
  **시그니처를 지키면서** 같은 목적을 달성합니다
- **입력 검증은 경계에서 한 번만** — 라우터가 Pydantic 스키마로 받고, 서비스는 검증된 값만 받습니다.
  서비스가 `Request`를 모르므로 HTTP 밖에서도 부를 수 있고 테스트도 쉽습니다

---

## 2. 기술 스택

| 계층 | 사용 기술 |
|------|-----------|
| **Frontend** | React 19 + TypeScript + Vite 6 + TanStack Query v5 + Tailwind CSS v3 + React Router v7 |
| **Backend** | FastAPI 0.135 + SQLAlchemy 2.0 (async) + Pydantic v2 |
| **Database** | MySQL 8 (aiomysql) + Alembic |
| **Cache / Session** | Redis 7 |
| **인증** | PyJWT (HS256) + HttpOnly Cookie + Argon2 + OAuth (Google, Kakao) |
| **테스트** | pytest + pytest-asyncio + httpx AsyncClient + fakeredis / vitest + jsdom |
| **로깅** | 표준 logging + QueueHandler 비동기 파이프라인 + 요청 ID |
| **도구** | uv (파이썬·의존성) + ruff (린트) + GitHub Actions |

---

## 3. 빠른 시작

### 3.1 사전 준비

- **uv** — 파이썬 인터프리터까지 uv 가 관리하므로 파이썬을 따로 설치할 필요가 없습니다 (설치법은 3.3)
- Node 20+
- Docker — MySQL·Redis를 띄우는 데만 씁니다 (앱은 로컬에서 실행)

```bash
docker compose up -d     # MySQL 8 + Redis 7
docker compose ps        # 둘 다 healthy 인지 확인
```

DB 두 개(`db_example`, `db_base_test`)가 자동으로 만들어지고, 값은 `backend/.env.example`의
`local_*` 기본값과 맞춰져 있어 `.env`만 복사하면 바로 붙습니다.

> **이미 MySQL/Redis를 직접 설치해 쓰고 있다면** 포트가 충돌합니다. 기존 서비스를 끄거나,
> 저장소 루트에 `.env`를 만들어 `MYSQL_PORT=3307` / `REDIS_PORT=6380` 으로 바꾸고
> `backend/.env`의 `mysql_port`·`local_redis_port`도 같은 값으로 맞추세요.
> Docker를 안 쓰고 직접 설치한 것을 그대로 써도 됩니다 — 그때는 아래 두 DB를 직접 만드세요.
>
> ```sql
> CREATE DATABASE db_example    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> CREATE DATABASE db_base_test  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> ```

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

> 백엔드 의존성은 **uv** 가 관리합니다 (`pyproject.toml` + `uv.lock`). `pip` 은 쓰지 않습니다.

```bash
# jwt_secret / hash_key 생성
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

OAuth 키를 비워두면 소셜 로그인만 동작하지 않고 서버는 정상 기동합니다.

### 3.3 실행

백엔드는 [uv](https://docs.astral.sh/uv/)가 필요합니다. 한 번만 설치하면 됩니다.

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
# Windows (PowerShell)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

```bash
# Backend
cd backend
uv sync                     # 가상환경 + 의존성. 파이썬 3.12가 없으면 uv가 받아옵니다
sh migrate.sh "init"        # 테이블 생성
sh run.sh                   # http://localhost:8000  (문서: /docs)

# Frontend
cd frontend
npm install
npm run dev                 # http://localhost:3000
```

> `uv sync` 는 `.venv` 생성 · 파이썬 버전 맞추기 · 의존성 설치를 한 번에 합니다.
> **활성화(`activate`)할 필요가 없습니다** — 명령 앞에 `uv run` 을 붙이면 됩니다 (`uv run pytest`).
> `run.sh` · `migrate.sh` 도 내부에서 `uv run` 을 씁니다.

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
| `access_token_minutes` | | access 토큰 수명(분). 기본 30. **무효화 지연 = 이 값** |
| `refresh_token_hours` | | refresh 토큰 수명(시간). 기본 168(7일). 로테이션이 걸려 있어 길게 잡아도 됨 |
| `hash_key` | ✅ | 내부 해시용 키 |
| `openai_api_key` | | 없으면 GPT 기능만 비활성 |
| `kakao_client_id` / `_secret` | | Kakao OAuth |
| `local_kakao_redirect_uri` / `prod_kakao_redirect_uri` | | 카카오 콘솔 등록값과 **정확히** 일치해야 함 |
| `google_client_id` / `_secret` | | Google OAuth |
| `local_google_redirect_uri` / `prod_google_redirect_uri` | | Google 콘솔 등록값과 일치해야 함 |
| `local_domain` / `prod_domain` | ✅ | CORS 오리진 + 쿠키 도메인을 여기서 함께 유도 |
| `cookie_samesite` | | `lax`(기본) / `strict` / `none`. **lax 가 곧 CSRF 방어** |

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
| `prod` / `production` | prod | `secure=True` |
| `local` / `development` | local | `secure=False` |
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
├── pyproject.toml                         # 의존성(uv) + ruff + pytest 설정
├── uv.lock                                # 해석된 정확한 버전. 커밋 대상
├── .python-version                        # 3.12
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
    │   ├── provider/                      # 의존성 주입 + 인증
    │   │   ├── http/
    │   │   │   ├── service.py             # ServiceProvider(lazy property 모음) + Auth
    │   │   │   └── deps.py                # Provider / UserProvider / AdminProvider
    │   │   └── web_socket/                # WS용 동일 2종
    │   ├── middleware/
    │   │   ├── register.py                # 미들웨어 등록 순서
    │   │   ├── cors.py                    # settings.cors_origins 기반
    │   │   ├── request_id.py              # 요청 ID 발급 + 액세스 로그
    │   │   └── security.py                # 보안 헤더
    │   ├── exception/handler.py           # 예외 → BaseResponse 매핑
    │   ├── logging/                       # QueueHandler 비동기 파이프라인
    │   └── utils/
    │       ├── response.py                # success() / fail() / BaseResponse
    │       ├── rate_limit.py              # IP×엔드포인트 + 계정×실패 (Redis)
    │       └── http_client.py             # 공용 아웃바운드 httpx 클라이언트
    │
    └── module/
        ├── __init__.py                    # setup_routers() — 라우터 등록 한 곳
        ├── auth/
        │   ├── auth_router.py             # /api/auth/**
        │   ├── auth_schema.py             # LoginIn · SignupIn · OAuthCodeIn · SessionOut
        │   ├── auth_service.py            # 로그인·로그아웃·refresh
        │   ├── auth_revoke.py             # 세션 무효화 (거부 목록 + 버전 카운터)
        │   └── auth_token.py              # JWT 생성·검증, 쿠키 4종 심기 → SessionOut 반환
        ├── user/                          # user.py(모델) + schema + repository + service + router
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
    │   │   ├── layout/                    # sideBar(groupLink·subLink), login
    │   │   ├── ui/form/                   # button, inputbox, selectBox, comboBox, calendar,
    │   │   │                              #   checkbox, radioButton, toggle, textareaBox
    │   │   ├── ui/feedback/               # modal, formModal, confirmModal, alert, toast
    │   │   ├── ui/table/                  # table, tableHeader, tableBody (Row 제네릭)
    │   │   └── ui/                        # statCard, skeleton, pagination, loading
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
  ↓         (파라미터 타입 하나로 DI + 인증: p: Provider / UserProvider / AdminProvider)
service     로직. 다른 서비스가 필요하면 생성자로 받는다
  ↓
repository  쿼리만. SQLAlchemy 세션을 들고 있음
  ↓
model       SQLAlchemy 선언
```

라우터 예시 — 데코레이터가 없습니다.

```python
@router.get("/me")
async def get_me(p: UserProvider):
    return success(await p.user_service.get_me(p.auth.user_id))

@router.delete("/group/{group_id}/member/{member_id}")
async def remove(group_id: int, member_id: int, p: AdminProvider):
    await p.group_service.remove_member(group_id, member_id)
    return success(message="removed")
```

| 타입            | 의미                        |
| --------------- | --------------------------- |
| `Provider`      | 비로그인. `p.auth` 는 `None` |
| `UserProvider`  | user 토큰 필수              |
| `AdminProvider` | admin 토큰 필수             |

path·query·body 는 그냥 파라미터로 선언하면 FastAPI 가 파싱·검증·문서화를 전부 합니다.
`p.request.path_params[...]` 나 `await p.request.json()` 은 쓰지 마세요 — 검증이 사라지고
잘못된 입력이 422 가 아니라 500 으로 나갑니다.

> `Provider` 계열은 기본값이 없으므로 **기본값 있는 파라미터보다 앞**에 와야 합니다.
> `async def list_items(p: UserProvider, page: int = 1)` — 어기면 `SyntaxError` 로 즉시 터집니다.

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

- 성공: `return success(data)` — `app/core/utils/response.py`. `BaseResponse` **모델**을 반환합니다
- 실패: `fail("메시지", "ERROR_CODE", 403)` — 어디서든 호출 가능. `HTTPException`을 던지고 전역 핸들러가 변환
- 요청 스키마 검증 실패: 전역 핸들러가 `422` + `errorCode: "VALIDATION_ERROR"` 로 변환합니다.
  메시지는 `"email: Field required"` 형태라 프론트에서 그대로 띄울 수 있습니다

**응답도 스키마로 고정합니다.** 라우터에 `response_model=BaseResponse[XxxOut]` 을 걸면
`/docs` 에 뜨는 것에 더해 **FastAPI가 실제 응답을 그 스키마로 강제**합니다 — 스키마에 없는
필드는 잘려 나갑니다. `password` 유출을 사람이 아니라 타입이 막습니다.

```python
@router.get("/me", response_model=BaseResponse[UserOut])
async def get_me(p: UserProvider):
    return success(await p.user_service.get_me(p.auth.user_id))
```

- **`JSONResponse` 를 직접 반환하지 마세요.** 반환하면 FastAPI가 손대지 않고 그대로 내보내서,
  선언한 스키마와 실제 응답이 달라도 아무도 잡지 못합니다
- `datetime`·`Decimal`·`UUID`·`Enum` 은 알아서 직렬화됩니다. 손으로 `.isoformat()` 을 부르지 마세요
- 쿠키·헤더는 `response: Response` 를 파라미터로 주입받아 심습니다 (`auth_router.login` 참고)

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

> `--workers N`으로 멀티 프로세스 기동하면 파일 로테이션이 충돌합니다.
> 그땐 파일 핸들러 대신 stdout 수집(systemd/docker 로그 드라이버)으로 전환하세요.

#### 도메인별 로그 파일 추가하기

외부 API 연동처럼 "이것만 따로 보고 싶은" 영역은 전용 파일로 뺄 수 있습니다.
`gemini.log`를 추가한다고 해봅시다.

**① 채널을 가르는 원리를 먼저 알아둘 것**

파일을 나누는 주체는 로거가 아니라 **핸들러에 달린 필터**입니다.
모든 로그는 하나의 큐를 지나 리스너 스레드로 가고, 리스너가 들고 있는 싱크마다
"이 레코드가 내 것인가"를 필터로 판단합니다.

```
logger.info(...)
    → QueueHandler (여기서 request_id 부착)
        → Queue
            → QueueListener (별도 스레드)
                ├─ console        필터 없음        → 전부
                ├─ app.log        필터 없음        → 전부
                ├─ access.log     AccessOkFilter   → status 2xx/3xx
                ├─ error.log      ErrorFilter      → status 4xx/5xx 또는 ERROR 이상
                └─ gemini.log     LoggerPrefixFilter("app.module.infra.gemini")
                                                   → 그 프리픽스 하위 로거만
```

이 구조라서 **전용 파일에 남는 로그는 `app.log`에도 그대로 남습니다.** 빠지는 게 아니라 복사되는 겁니다.
그리고 로거에 핸들러를 직접 붙이지 않으므로, 파일을 아무리 늘려도 쓰기는 전부 리스너 스레드에서만 일어납니다
(= 이벤트 루프를 막지 않습니다).

**② 로거 이름을 확인한다** — 이게 유일하게 틀리기 쉬운 부분입니다.

`LoggerPrefixFilter`는 **로거 이름의 앞부분**을 봅니다. 이 템플릿은 대부분
`get_logger(__name__)`을 쓰므로 로거 이름 = 모듈의 점 경로입니다.

| 파일 | `__name__` (= 로거 이름) |
|------|--------------------------|
| `app/module/infra/gemini/gemini_service.py` | `app.module.infra.gemini.gemini_service` |
| `app/module/infra/gemini/client.py` | `app.module.infra.gemini.client` |

두 파일을 한 로그로 모으려면 **공통 조상**인 `app.module.infra.gemini`를 프리픽스로 쓰면 됩니다.
필터는 `이름 == 프리픽스` 이거나 `이름이 프리픽스 + "."으로 시작`할 때 통과시키므로,
그 패키지 아래 파일을 나중에 더 만들어도 자동으로 포함됩니다.

**③ 상수에 한 줄 추가한다** — `backend/app/core/logging/config.py`

```python
EXTRA_LOG_CHANNELS: dict[str, str] = {
    "openai": "app.module.infra.gpt",
    "gemini": "app.module.infra.gemini",   # ← 추가. 키가 파일명(gemini.log)이 된다
}
```

이게 전부입니다. `setup_logging()`이 이 dict를 돌면서 싱크를 만들어 붙입니다.

**④ 서비스에서 그냥 평소대로 로깅한다**

```python
# app/module/infra/gemini/gemini_service.py
from app.core.logging import get_logger

logger = get_logger(__name__)      # → app.module.infra.gemini.gemini_service

class GeminiService:
    async def generate(self, prompt: str):
        logger.info("gemini 호출 model=%s", model)     # gemini.log + app.log
        ...
        logger.exception("gemini 호출 실패")           # gemini.log + app.log + error.log
```

특별한 로거를 따로 만들 필요가 없습니다. `__name__`만 쓰면 위치가 곧 채널이 됩니다.

**⑤ 확인**

```bash
ls backend/logs/          # app.log  access.log  error.log  openai.log  gemini.log
tail -f backend/logs/gemini.log
```

**모듈 경로와 무관한 이름으로 묶고 싶다면**

`__name__` 대신 이름을 직접 주면 됩니다. 이 템플릿도 액세스 로그에 이 방식을 씁니다
(`get_logger("http.access")`, `get_logger("http.outbound")`).

```python
logger = get_logger("llm.gemini")        # 파일 위치와 상관없이 이 이름
```

```python
EXTRA_LOG_CHANNELS = { "gemini": "llm.gemini" }
```

여러 폴더에 흩어진 코드를 한 파일로 모을 때 편합니다. 대신 이름을 사람이 관리해야 하므로,
특별한 이유가 없으면 `__name__` 쪽을 권합니다.

**주의할 점**

- **프리픽스는 점(`.`) 경계로만 매칭됩니다.** `app.module.infra.gpt`는
  `app.module.infra.gpt_v2`를 잡지 않습니다 (`gpt.`로 시작하지 않으므로). 의도한 동작입니다
- **오타가 나도 에러가 안 납니다.** 존재하지 않는 프리픽스를 적으면 빈 파일만 생깁니다.
  파일이 0바이트면 프리픽스를 의심하세요
- 채널을 늘리면 **열린 파일 핸들도 같이 늘어납니다.** 자정마다 전부 로테이션되므로
  수십 개씩 만들 거라면 stdout 수집 + 외부 수집기(Loki 등)를 쓰는 편이 낫습니다
- `EXTRA_LOG_CHANNELS`의 키는 그대로 파일명이 되므로 경로 구분자나 공백은 넣지 마세요

### 6.5 마이그레이션

리비전은 **로컬에서 만들어 커밋**하고, 서버는 **적용만** 합니다. 서버에서 autogenerate 하면 히스토리가 갈라집니다.

```bash
# 로컬 — 모델 변경 후
sh migrate.sh "add order table"     # revision --autogenerate + upgrade head
git add backend/alembic/versions/   # 생성된 리비전은 반드시 커밋

# 서버 — 배포 시
git pull && uv sync --frozen --no-dev --group prod
APP_ENV=prod sh migrate_server.sh   # upgrade head 만
```

> 테이블이 이미 있는 DB에 처음 도입할 때는 `alembic stamp head`를 1회 실행하세요.

### 6.6 API

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| `GET` | `/api/health` | — | liveness (LB·컨테이너용) |
| `POST` | `/api/auth/signup` | — | 회원가입 → 201. 세션은 만들지 않는다(이어서 `/login`). 5회/분 |
| `POST` | `/api/auth/login` | — | 이메일/비밀번호 로그인 → 쿠키 4종 발급 + `data: SessionOut`. 본문 `type`으로 `user`/`admin` 구분. **10회/분(IP) · 5회 실패/10분(계정)** |
| `POST` | `/api/auth/logout` / `/logout_admin` | user / admin | 쿠키 만료 |
| `POST` | `/api/auth/refresh_token` / `_admin` | refresh 쿠키 | 세션 갱신 → `data: SessionOut` |
| `POST` | `/api/auth/google` / `/kakao` | — | OAuth 콜백 코드 → 쿠키 발급 + `data: SessionOut`. 10회/분(IP) |
| `GET` | `/api/user/me` | user | 내 정보 → `data: UserOut` |
| `POST` | `/api/upload/image` | user | 이미지 업로드 → `data: {url}`. 10MB·확장자 제한, 20회/분 |
| `WS` | `/api/ws/` | — | WebSocket 연결 |

로그인 요청 본문:

```jsonc
{ "email": "a@b.com", "password": "…", "type": "user" }   // type: "user" | "admin"
```

로그인·refresh 응답의 `data`(`SessionOut`)는 `{p}user_info` 쿠키에 담기는 내용과 **같은 객체**입니다
(`create_jwt_token()`이 하나를 만들어 쿠키에 싣고 그대로 반환합니다). 프론트는 쿠키를 파싱하지 않고도
로그인 직후 세션 정보를 바로 쓸 수 있습니다.

**비어 있는 것** — `/api/admin`은 라우터만 등록돼 있고 비어 있습니다. 프로젝트에 맞춰 채울 자리입니다.
회원가입은 가입만 하고 세션을 만들지 않습니다 — 자동 로그인이 필요하면 `auth_router.signup`의
주석을 참고해 `create_jwt_token()`을 부르면 됩니다.

전체 스펙은 서버 기동 후 `http://localhost:8000/docs`. 요청 바디·path·query 파라미터가
스키마와 함께 그대로 뜨므로, 프론트 타입을 `openapi-typescript` 같은 도구로 생성할 수도 있습니다.

---

### 6.7 테스트

라우터 하나를 끝낼 때마다 엣지 케이스까지 붙여서 돌리는 것을 기본 흐름으로 잡았습니다.

```bash
# docker compose 를 썼다면 db_base_test 는 이미 만들어져 있습니다.
# 직접 설치한 MySQL 을 쓴다면 최초 1회 — .env 의 test_mysql_db 와 같은 이름으로
mysql -u root -p -e "CREATE DATABASE db_base_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

cd backend
uv run pytest                              # 전체 (84개)
uv run pytest tests/test_user_router.py -v # 한 파일
```

| 파일 | 본보기로 삼을 것 |
|------|------------------|
| `tests/test_user_router.py` | 인증 엣지 케이스, 응답 규약, 민감 필드 노출 방지 |
| `tests/test_auth_router.py` | 요청 스키마 검증(422), 쿠키 발급·만료 |
| `tests/test_rate_limit.py` | 빈도 제한(429), 프록시 헤더 신뢰 규칙, fail-open |
| `tests/test_auth_revoke.py` | 로테이션·재사용 탐지, 세션 무효화, 계정 비활성화 |
| `tests/test_settings_cookie.py` | SameSite 해석·기동 경고 (CSRF 방어 스위치) |

**설계**

| | 방식 | 이유 |
|---|------|------|
| **DB** | 전용 MySQL (`test_mysql_db`) | 운영과 같은 엔진. SQLite로 대체하면 `DateTime(timezone=True)` round-trip이 달라진다 |
| **격리** | 테스트당 트랜잭션 + 롤백 | 앱이 `commit()`을 불러도 SAVEPOINT로 잡혀서 데이터가 안 남는다 |
| **Redis** | fakeredis | 실제 Redis 없이도 돈다 |
| **인증** | 진짜 JWT 발급 | 목킹하면 `auth_token.py`의 검증 로직이 테스트되지 않는다 |

**운영 DB 보호** — `settings.test_database_url`은 `self.env`를 타지 않고 항상 `local_*` 접속
정보에 `test_mysql_db`만 붙입니다. `APP_ENV=prod` 셸에서 실수로 pytest를 돌려도 운영 DB에
붙지 않습니다. 테스트가 매 세션 테이블을 drop 하므로 필요한 보호이고, `test_mysql_db`가
`local_mysql_db`·`prod_mysql_db`와 같으면 `conftest.py`가 기동 시점에 중단시킵니다.

**쓸 수 있는 픽스처**

| 이름 | 용도 |
|------|------|
| `client` | httpx AsyncClient. 테스트 DB와 fakeredis가 물려 있다 |
| `db` | AsyncSession. 끝나면 자동 롤백 |
| `make_user` / `make_admin` | 데이터 팩토리 |
| `auth_header(id, auth_type="user", **kw)` | 로그인 상태 Cookie 헤더 |
| `cookie_header(**cookies)` | 임의 쿠키 조립 |
| `make_token(...)` | 만료·refresh·서명불일치 등 엣지 케이스용 JWT |

```python
async def test_내_정보를_반환한다(client, make_user):
    user = await make_user(email="me@example.com")

    res = await client.get("/api/user/me", headers=auth_header(user.id))

    assert res.status_code == 200
    assert res.json()["data"]["email"] == "me@example.com"
```

> 요청에 `cookies=` 인자를 쓰지 마세요. httpx에서 deprecated고, `client.cookies`에 심으면
> 다음 요청까지 남습니다. `headers=auth_header(...)` 로 요청 단위로 통제합니다.

**Claude Code로 돌릴 때** — `/test {도메인}` 커맨드가 `be-researcher` → `be-test-writer` 순으로
돌린 뒤 pytest를 실행합니다. 덮어야 할 엣지 케이스 목록은 `.claude/agents/be-test-writer.md`에
있습니다. 테스트가 앱 버그를 잡으면 에이전트는 **고치지 않고 멈춰서 보고**하도록 되어 있습니다 —
기대값에 맞춰 테스트를 느슨하게 만드는 게 제일 흔한 실패 방식이라서.

---

## 7. 인증

### 7.1 쿠키 4종

로그인/refresh 성공 시 백엔드가 내려주는 쿠키입니다. 접두사는 `user_` 또는 `admin_`.

| 쿠키 | httponly | 수명 | 용도 |
|------|----------|------|------|
| `{p}access_token` | ✅ | access | API 인증 |
| `{p}refresh_token` | ✅ | refresh | 세션 갱신 |
| `{p}user_info` | ❌ | access | 프론트가 읽는 세션 정보 (base64 JSON) |
| `{p}refresh_exp` | ❌ | refresh | "refresh 세션이 살아있다"는 마커 |

수명은 `.env` 의 `access_token_minutes`(기본 30) / `refresh_token_hours`(기본 168 = 7일)에서 옵니다.
**`access_token_minutes` 는 무효화(로그아웃·비번변경·계정정지)가 적용되기까지의 최대 지연**이기도 합니다.

refresh 토큰은 쓸 때마다 **로테이션**됩니다 — 갱신하면 옛 토큰이 죽고, 죽은 토큰이 다시 오면
유출로 보고 그 계정의 **모든 세션을 끊습니다**(`SESSION_REUSE_DETECTED`). 그래서 수명을
며칠 단위로 잡아도 됩니다. 자세한 내용은 `backend/CLAUDE.md` 의 "세션 무효화".

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

관리자 영역은 `App.tsx`에서 `<PrivateRoute authType="admin">`이 `AdminLayout`을 통째로 감쌉니다.
**`AdminLayout`은 레이아웃만 담당하고 인증을 알지 못합니다** — 예전엔 같은 가드 로직이 양쪽에 있어서
고칠 때 두 군데를 같이 봐야 했습니다.

### 8.2 디자인 시스템

Vercel 콘솔 계열의 토큰 시스템입니다. 전체 규칙은 **[`DESIGN.md`](DESIGN.md)** 에 있습니다.

- 색은 `src/index.css`의 CSS 변수 → `tailwind.config.js`가 Tailwind 클래스로 노출.
  `darkMode: "class"`로 라이트/다크가 자동 전환됩니다. **색을 직접 쓰지 말고 토큰을 쓸 것**
- 깊이는 `border`가 아니라 **`shadow-border`**(1px 링) — 레이아웃 크기를 바꾸지 않아 hover·focus에서 요소가 밀리지 않습니다
- 폰트는 Geist(`public/fonts/`) → Pretendard(CDN, 한글). 식별자·코드는 Geist Mono
- 제목은 음수 트래킹(`tracking-title`·`tracking-heading`), 표·지표의 숫자는 `tabular-nums`

새 프로젝트에서 색감을 바꿀 때는 `index.css`의 CSS 변수만 고치면 됩니다.
값은 **공백으로 구분한 RGB 숫자**(`37 99 235`)여야 `bg-primary/50` 같은 알파 변형이 동작합니다.

### 8.3 useAPI

`fetch` 래퍼 + TanStack Query. 401을 만나면 자동으로 refresh 후 원 요청을 재시도합니다.

- 모든 요청은 `credentials: "include"` — 쿠키 인증이라 필수
- 응답은 `BaseResponse<T>`로 파싱
- refresh는 타입(`user`/`admin`)당 1회만 — 동시에 401이 여러 개 떠도 네트워크 호출은 한 번
- refresh까지 실패하면 `AuthExpiredError`를 던지고 `auth:expired` 이벤트 발행. React Query 재시도 대상에서 제외

### 8.4 관리자 메뉴 추가

메뉴는 `container/admin/layout.tsx`의 `adminMenu` 한 곳에서 정의합니다.
어드민은 **사이드바 단독** 구성이라 상단 헤더가 없고, 페이지 제목은 각 컨테이너가 직접 그립니다.

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

## 8.5 CI · 배포 이미지

`.github/workflows/ci.yml` 이 push·PR마다 아래를 돌립니다. `CLAUDE.md` 의 "검증 명령"을
사람 기억이 아니라 파이프라인에 고정한 것입니다.

| job | 하는 일 |
|-----|---------|
| `backend` | MySQL·Redis 서비스 컨테이너를 띄우고 `ruff` + `pytest` (uv 가 파이썬까지 맞춥니다) |
| `frontend` | `check:types` · `lint` · `build` |
| `docker` | `backend/Dockerfile` 빌드 — 배포 직전에야 깨진 걸 아는 상황을 막습니다 |

서비스 컨테이너는 `docker-compose.yml` 과 **같은 이미지·같은 healthcheck** 를 씁니다.

### 배포용 이미지

```bash
docker build -t base-backend ./backend
docker run --rm -p 8000:8000 --env-file backend/.env base-backend
```

- `python:3.12-slim` 고정 — 서버의 시스템 파이썬 버전과 무관해집니다
- 멀티스테이지 — 빌더에서 `uv sync --frozen --no-dev` 로 `.venv` 를 만들고 그것만 런타임으로 옮깁니다.
  컴파일러도 uv 바이너리도 최종 이미지에 남지 않고, 소스만 바뀐 빌드는 의존성 레이어가 캐시됩니다
- 비루트(`uid 10001`) 실행, `APP_ENV=prod` 가 이미지에 박혀 있습니다
  (이걸 빠뜨려 `local` 로 떨어지는 것이 이 템플릿의 단골 사고입니다)
- `.env` 는 `.dockerignore` 로 제외됩니다 — 운영 값은 `--env-file` / `-e` 로 주입하세요
  (`.env` 가 없으면 pydantic-settings 가 실제 환경변수에서 읽습니다)
- 마이그레이션은 컨테이너에서: `docker run --rm --env-file … base-backend alembic upgrade head`

> **개발에는 이 이미지를 쓰지 마세요.** 핫리로드를 하려면 소스를 바인드 마운트해야 하는데,
> Windows 에서 `C:\...` 를 마운트하면 파일 I/O 가 느리고 `inotify` 이벤트가 넘어오지 않아
> `--reload` 와 Vite HMR 이 제대로 동작하지 않습니다. 개발은 `uv sync` + `sh run.sh` 로 하고,
> Docker 는 **인프라(compose)와 배포(이미지)** 에만 씁니다.

---

## 9. 새 프로젝트로 가져갈 때

```bash
git clone https://github.com/gnaak/base.git my-project
cd my-project
rm -rf .git && git init
```

**Claude Code 를 쓴다면 `/setup` 한 번이면 됩니다** — 아래 항목을 훑어서 무엇이 아직
템플릿 기본값인지 표로 보여주고 항목별로 승인받아 고칩니다.

체크리스트:

- [ ] `backend/.env.example` → `backend/.env` 복사 후 값 채우기
- [ ] **`jwt_secret`·`hash_key`를 새로 생성** — 템플릿 값을 그대로 쓰면 다른 프로젝트에서 발급한 토큰이 통과합니다
- [ ] `frontend/.env.example` → `frontend/.env` 복사 후 값 채우기
- [ ] `backend/.env`의 `prod_domain` — 운영 도메인. CORS 오리진과 쿠키 도메인이 여기서 유도됩니다
- [ ] `frontend/.env.production`의 `VITE_APP_PUBLIC_BASE_URL`
- [ ] `container/admin/layout.tsx`의 `adminMenu` 샘플 교체
- [ ] 테스트 DB 생성 — `CREATE DATABASE db_base_test;` (`.env`의 `test_mysql_db`와 같은 이름)
- [ ] `backend/alembic/versions/` 초기화 여부 결정 (User·Admin 테이블을 그대로 쓸지)
- [ ] OAuth 콘솔에 새 redirect URI 등록
- [ ] 배포 시 `APP_ENV=prod` 명시

Claude Code로 개발한다면 `CLAUDE.md`, `frontend/CLAUDE.md`, `backend/CLAUDE.md`에 규칙이 정리돼 있습니다.

### `.claude/` 에 들어있는 것

| | |
|---|---|
| `commands/` | `/feature` `/design` `/fullstack` `/fix` `/test` — 에이전트 호출 순서를 묶은 슬래시 커맨드 |
| `agents/` | 백엔드·프론트 탐색/작성 전담 서브에이전트 7종 |
| `commands/setup.md` | `/setup` — 템플릿을 새 프로젝트로 가져왔을 때 바꿀 것들 (clone 직후 1회) |
| `commands/seo_check.md` | `/seo_check` — 검색·AI 인용이 조용히 0이 되는 사고를 정적 점검 (푸시 전) |
| `skills/seo/` | SEO·AEO·GEO·LLMO·NEO(네이버) 진단·구현 스킬 |

> `skills/seo` 는 [fire-your-seo-agency](https://github.com/leopard627/fire-your-seo-agency)(MIT)를
> 가져와 이 템플릿에 맞게 손본 것입니다. **이 템플릿의 프론트는 CSR이라 `curl` 로 받으면 본문이
> 없습니다** — 검색 노출이 목표라면 스킬이 안내하는 대로 렌더링 전략(프리렌더/SSR)부터
> 정해야 하고, 로그인 뒤에서만 쓰는 도구라면 손댈 필요가 없습니다.

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
