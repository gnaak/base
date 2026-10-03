# Base — FastAPI + React 풀스택 템플릿

새 프로젝트마다 다시 만드는 것 — 쿠키 JWT 인증 · OAuth · 계층 구조 · 응답 규약 · 로깅 · 마이그레이션 · 배포 — 을
한 번 제대로 만들어 둔 템플릿. 받아서 셋업하면 **로그인이 되는 상태**에서 도메인 기능부터 시작한다.
Claude Code 로 쓰면 아이디어 → 기획 → 개발 → 검증까지 이어진다.

## 1. 들어 있는 것

| | 포함 | 없음 |
|---|---|---|
| 인증 | 로그인 · 로그아웃 · refresh 로테이션 + 재사용 탐지 · 세션 무효화 · 계정 비활성화 · 회원가입 API · Google · Kakao OAuth · user/admin 이중 세션 | 회원가입 화면 · 비밀번호 재설정 · 이메일 인증 |
| 백엔드 | 계층 구조 · DI · 응답 규약 · 에러코드 · 로깅 · Alembic · 페이지네이션 · 업로드 · 레이트리밋 | 도메인 로직 |
| 프론트 | 디자인 토큰(라이트 · 다크) · 관리자 레이아웃 · UI 킷(폼 · 표 · 모달 · 토스트 · 지표) · 고객 첫 화면 · 라우트 가드 | 도메인 화면 |
| 테스트 | pytest · vitest · Playwright E2E · CI 마이그레이션 검사 | 부하 테스트 |
| 인프라 | docker-compose(MySQL · Redis) · nginx · systemd · GitHub Actions · Terraform 자동 배포 + 롤백 | 컨테이너 배포 · SSR |
| Claude Code | `/start` · `/plan` · `/autopilot` · `/verify` · 단계별 에이전트 · 보안 · 배포 · SEO 스킬 | |

**설계에서 지킨 것**

- `router → service → repository` 를 폴더가 아니라 타입으로 고정한다 — `p: UserProvider` 하나에 DI 와 인증.
  서비스끼리 import 하지 않는다 ([chatbot_kt](https://github.com/gnaak/chatbot_kt) 의 Spring 계층을 FastAPI 로 옮긴 것)
- 설정 실수는 기동 시점에 잡는다 — DB · Redis 연결 fail-fast, 쿠키가 조용히 깨지는 조합은 경고
- 프론트 · 백엔드 인증 계약은 타입으로 맞춘다 — 백엔드 `SessionOut` ↔ 프론트 `UserInfo` 1:1

## 2. 기술 스택

| 계층 | 기술 |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6 + TanStack Query v5 + Tailwind CSS v3 + React Router v7 |
| Backend | FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2 |
| DB · 캐시 | MySQL 8 (aiomysql) + Alembic · Redis 7 |
| 인증 | PyJWT (HS256) + HttpOnly 쿠키 + Argon2 + OAuth (Google, Kakao) |
| 테스트 | pytest + httpx + fakeredis · vitest · Playwright |
| 도구 | uv · ruff · GitHub Actions · Terraform |

## 3. 시작하기

### Claude Code 로 — 개발 도구가 없어도 된다

1. VS Code + Claude Code 설치 — [`docs/guides/00-claude-code.html`](docs/guides/00-claude-code.html)
2. GitHub 의 **Use this template** 로 받아 VS Code 로 연다 — [`01-get-template.html`](docs/guides/01-get-template.html)
3. Claude 패널에 만들고 싶은 것을 말한다 — 한 줄도, 고객과 나눈 대화도, 계약서 파일(docx · hwpx · pdf)도 된다

처음 연 폴더면 시작 훅이 `/start` 로 이어 준다. 만들 것을 대화로 정하고 → 도구(uv · Node · MySQL 이 없을 때만 Docker) 설치 →
DB · 시크릿 · 이름 · git 셋업 → 테스트 통과 → `/plan`. 사람이 직접 할 일(설치 확인 창 · 비밀번호)은 안내 페이지와 메모장을 띄운다.

### 손으로

필요한 것: [uv](https://docs.astral.sh/uv/)(파이썬은 uv 가 받는다) · Node 20+ · MySQL 8 (없으면 Docker 로).
Redis 는 없어도 된다 — `backend/.env` 에 `local_redis_host=memory` (로컬 전용. 운영 서버는 진짜 Redis 를 쓴다)

```bash
docker compose up -d                       # MySQL 8 + Redis 7, DB 3개 생성
cp backend/.env.example backend/.env       # 키마다 주석이 있다
cp frontend/.env.example frontend/.env
uv --directory backend run python -m scripts.prepare_local secrets   # jwt_secret · hash_key 생성

cd backend && uv sync && uv run alembic upgrade head && sh run.sh   # :8000 (문서 /docs)
cd frontend && npm install && npm run dev                          # :3000
```

- 프론트 · 백엔드 호스트를 섞지 말 것 (`localhost` ↔ `127.0.0.1`) — 쿠키가 안 실려 "로그인은 200인데 세션 없음"
- 첫 실행에 `migrate.sh` 를 쓰지 말 것 — 리비전을 **새로 만드는** 스크립트다. 모델을 바꾼 뒤에 쓴다
- MySQL · Redis 가 이미 떠 있으면 그걸 써도 된다 (`backend/.env` 의 `local_*` 를 맞추고 DB 를 만든다).
  compose 와 같이 띄우려면 루트 `.env` 에 `MYSQL_PORT=3307` · `REDIS_PORT=6380`
- 기동 로그 첫 줄 `설정: env=local … cookie(…)` 에서 인식된 환경과 쿠키를 확인한다
- Docker 는 로컬 MySQL · Redis 에만 쓴다. 앱을 컨테이너에서 개발하지 말 것 (Windows 바인드 마운트는 `--reload` · HMR 이 안 된다)
- OAuth 키를 비워 두면 소셜 로그인만 꺼지고 서버는 뜬다

## 4. 구조

```
backend/      FastAPI — app/core(설정 · DB · 인증 · 미들웨어 · 로깅) · app/module(도메인마다 router → service → repository)
frontend/     React — container(페이지) · component(UI) · hooks(useAPI · 인증) · context
deploy/       nginx · systemd 설정 (자동 배포가 자리표시만 바꿔 깐다)
infra/        Terraform · 서버 배포 스크립트 (deploy.sh · rollback.sh)
docker/       로컬 MySQL 초기화
docs/guides/  처음 쓰는 사람용 안내 페이지
.claude/      커맨드 · 에이전트 · 훅 · 스킬
```

폴더 단위 설명은 [`backend/CLAUDE.md`](backend/CLAUDE.md) · [`frontend/CLAUDE.md`](frontend/CLAUDE.md).

## 5. API

| 메서드 | 경로 | 인증 | |
|---|---|---|---|
| `GET` | `/api/health` | — | liveness |
| `POST` | `/api/auth/signup` | — | 회원가입 → 201. 세션은 만들지 않는다. 5회/분 |
| `POST` | `/api/auth/login` | — | `{ email, password, type: "user" \| "admin" }` → 쿠키 4종 + `data: SessionOut`. IP 10회/분 · 계정 5회 실패/10분 |
| `POST` | `/api/auth/logout` · `/logout_admin` | user · admin | 쿠키 만료 |
| `POST` | `/api/auth/refresh_token` · `_admin` | refresh 쿠키 | 세션 갱신 (로테이션) |
| `POST` | `/api/auth/google` · `/kakao` | — | OAuth 콜백 코드 → 쿠키 4종. 10회/분 |
| `GET` | `/api/user/me` | user | 내 정보 |
| `POST` | `/api/upload/image` | user | 이미지 → `data: {url}`. 10MB · 확장자 · 내용 검사. 20회/분 |
| `WS` | `/api/ws/` | — | WebSocket |

전체 스펙은 `http://localhost:8000/docs`. `/api/admin` 은 라우터만 있다 — 채울 자리.

## 6. 더 자세히

| 무엇 | 어디 |
|---|---|
| 인증 계약(쿠키 4종) · 무한 새로고침 · 작업 원칙 · 검증 명령 · 배포 주의 | [`CLAUDE.md`](CLAUDE.md) |
| 라우터 패턴 · DI · 응답 규약 · 레이트리밋 · 세션 무효화 · 도메인 설정 · 로깅 · 마이그레이션 · 테스트 | [`backend/CLAUDE.md`](backend/CLAUDE.md) |
| useAPI · 인증 상태 · 라우트 가드 · 관리자 메뉴 · E2E | [`frontend/CLAUDE.md`](frontend/CLAUDE.md) |
| 색 · 간격 · 깊이 토큰, 컴포넌트 규칙 | [`DESIGN.md`](DESIGN.md) |
| 환경 변수 | `backend/.env.example` · `frontend/.env.example` |
| 자동 배포 — Terraform · CI · 롤백 | [`infra/README.md`](infra/README.md) |
| 손 배포 — nginx · systemd | [`deploy/README.md`](deploy/README.md) |

## 7. 새 프로젝트로 가져갈 때

**Claude Code** — Use this template → `/start` → `/plan` → `/autopilot`

- `/start` — 아래 체크리스트의 로컬 부분을 기본값으로 처리한다
- `/plan` — 인터뷰 → 리서치(경쟁 · UX · 디자인 · 연동 · 규제) → PRD → 페이지 맵 · 테마 → `PROJECT.md`(phase 계획) · `DECISIONS.md`.
  사람이 붙는 건 인터뷰뿐이다. 돈 · 법 결정은 기본값으로 진행하고 `DECISIONS.md` 에 모은다
- `/autopilot` — phase 1 부터 끝까지 무인. 구현 → E2E → `/verify` → 커밋, 막히면 ❌ 로 적고 다음. push · merge · 배포는 하지 않는다
- `/setup` — 하나씩 확인하며 고칠 때 · 배포 설정

**체크리스트** — 바꿀 위치 표는 [`CLAUDE.md`](CLAUDE.md) "새 프로젝트로 가져갈 때"

- [ ] Use this template(또는 clone 뒤 `.git` 새로) → 새 저장소. CI 는 첫 푸시부터 돌고, 배포 잡은 AWS 연결 전까지 건너뛴다
- [ ] `jwt_secret` · `hash_key` 새로 생성 — 템플릿 값이면 다른 프로젝트 토큰이 통과한다
- [ ] DB 이름 3개(개발 · pytest · E2E)를 프로젝트 이름으로, 서로 다르게 — `backend/.env` · `frontend/e2e/env.ts` · `docker/mysql/init.sql`.
      개발 DB 는 실제로 있어야 서버가 뜬다
- [ ] Redis — `local_redis_password` 를 실제 Redis 와 맞춘다. 다른 프로젝트와 같이 쓰면 `redis_db` 를 나눈다
- [ ] `frontend/index.html` · `public/`(robots · sitemap · llms.txt)의 `BASE` · `example.com`, `google-site-verification`(남의 값이면 지운다), `public/image.png`
- [ ] 브랜드 색(`src/index.css` 변수 — `DESIGN.md` 먼저) · `adminMenu` · `SAMPLE_USERS` 대시보드
- [ ] 결정 — alembic 리비전 유지/초기화(`sh migrate.sh "init"`) · 토큰 수명(`.env.example` 권장값) ·
      OAuth 콘솔에 `http://localhost:3000/{google,kakao}/login` · 검색 노출(`/seo_check`) · `need.md` · `CHANGELOG.md` 는 지워도 된다
- [ ] 배포 — [`infra/README.md`](infra/README.md): `edge` 고르기 → AWS 키 · `infra/.env` · `terraform.tfvars` → `./infra/tf.ps1 apply` →
      GitHub Variables 3개 → Parameter Store 에 OAuth 키 → main 푸시. 운영 `.env` 는 만들지 않는다 (배포마다 SSM 에서)

## 8. `.claude/`

| | |
|---|---|
| `commands/` | `/start`(처음 한 번) → `/plan` → `/feature` `/design` `/fullstack` `/fix` `/test` → `/verify`(phase 끝 · 푸시 전) · `/autopilot`(무인) · `/setup` · `/seo_check` |
| `agents/` | `plan/`(리서치 · PRD · 페이지 맵 · 디자인) · `dev/backend/`(외부 연동 포함) · `dev/frontend/` · `verify/`(테스트 · 보안 · 완료 기준) |
| `hooks/` · `settings.json` | 시작 훅(처음 연 폴더 → `/start`) · 무인 게이트(근거로 다음 지시 · push · 배포 차단) · 위험 명령 거부 |
| `skills/` | `security/`(이 템플릿 기준 체크리스트) · `deploy/`(배포 길 찾기 · 장애 진단) · `seo/`([fire-your-seo-agency](https://github.com/leopard627/fire-your-seo-agency), MIT) |

> 프론트는 CSR 이라 `curl` 로 받은 HTML 에 본문이 없다. 검색 노출이 목표면 렌더링 전략(프리렌더 · SSR)부터 정한다.
> 로그인 뒤에서만 쓰는 도구면 신경 쓸 것 없다.

## 9. 트러블슈팅

| 증상 | 확인 |
|---|---|
| 로그인은 200인데 세션이 안 잡힘 | DevTools 에서 쿠키가 저장됐는지 → 호스트 섞임(`localhost` ↔ `127.0.0.1`) → `{env}_domain` → `APP_ENV` |
| 무한 새로고침 · 401 반복 | `user_info` 쿠키가 남았는지 — [`CLAUDE.md`](CLAUDE.md) "무한 새로고침 주의" |
| 배포 후 쿠키가 안 실림 | 기동 로그 `env=` 가 `local` 이면 `APP_ENV=prod` 누락 |
| 526 · 52x · 배포 실패 | [`infra/README.md`](infra/README.md) 트러블슈팅 · Claude 에게 "배포 실패" (deploy 스킬) |
| CORS 차단 | `{env}_domain` 에 포트까지 적었는지 (스킴은 뺀다) |
| 기동 즉시 종료 | DB · Redis 연결 실패 — 로그에 원인이 찍힌다 |
| alembic 히스토리 충돌 | 서버에서 autogenerate 했다 — 리비전은 로컬에서만 만든다 |
| 빌드한 프론트의 env 가 비어 있음 | `.env.production` 이 `.env` 를 키 단위로 덮는다. 빌드 머신에 `.env` 가 없으면 전부 적는다 |
| 갑자기 429 | 로그인 한도 — IP 10회/분 · 계정 5회 실패/10분 |

## 10. 상태

혼자 쓰려고 만든 템플릿이다. 새 프로젝트마다 부족했던 것을 되먹여 다듬는다.

- [`need.md`](need.md) — 지금 · 남은 것 · 확인 순서
- [`CHANGELOG.md`](CHANGELOG.md) — 무엇을 왜 바꿨는지 · 함정

시크릿은 `.env` 에만 두고 저장소에 올리지 않는다.
