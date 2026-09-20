# Base Template — CLAUDE.md

풀스택 프로젝트 베이스 템플릿. 세부 규칙은 `frontend/CLAUDE.md`, `backend/CLAUDE.md` 참고.

## 기술 스택

| 영역     | 기술                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| Frontend | React 19 + TypeScript + Vite 6 + TanStack Query v5 + Tailwind CSS v3 + react-router v7 |
| Backend  | FastAPI + SQLAlchemy 2.0 (async) + MySQL(aiomysql) + Redis + Alembic                   |
| 인증     | 쿠키 기반 JWT + OAuth (Google, Kakao)                                                  |

## 네이밍 규칙

| 대상                 | 규칙            | 예시                             |
| -------------------- | --------------- | -------------------------------- |
| 컴포넌트 / 클래스    | PascalCase      | `UserCard`, `AuthService`        |
| 타입 / 인터페이스    | PascalCase      | `UserInfo`, `BaseResponse<T>`    |
| 함수 / 변수 / 훅     | camelCase       | `handleSubmit`, `useAuth`        |
| 이벤트 핸들러        | `handle` 접두사 | `handleClick`                    |
| 폴더/파일 (Frontend) | camelCase       | `sideBar/`, `useAPI.ts`          |
| 폴더/파일 (Backend)  | snake_case      | `web_socket/`, `user_service.py` |

## 인증 계약 (프론트·백엔드 공통)

로그인/refresh 성공 시 백엔드가 내려주는 쿠키 4종. 접두사는 `user_` 또는 `admin_`.

| 쿠키               | httponly | 수명      | 용도                                  |
| ------------------ | -------- | --------- | ------------------------------------- |
| `{p}access_token`  | ✅       | access    | API 인증                              |
| `{p}refresh_token` | ✅       | refresh   | 세션 갱신                             |
| `{p}user_info`     | ❌       | access    | 프론트가 읽는 세션 정보 (base64 JSON) |
| `{p}refresh_exp`   | ❌       | refresh   | "refresh 세션이 살아있다"는 마커      |

수명은 `.env`의 `access_token_minutes`(기본 30) / `refresh_token_hours`(기본 168=7일)에서 온다.
**`access_token_minutes`는 무효화가 적용되기까지의 최대 지연**이기도 하다 — 무효화 확인을
refresh 시점에만 하기 때문이고, 그게 "access는 15~30분" 권고의 근거다.

- `user_info`의 필드는 `auth_token.create_jwt_token()`이 반환하는 `SessionOut`과 프론트
  `types/user.ts`의 `UserInfo`가 **1:1로 일치**해야 한다. 쿠키와 응답 `data`가 **같은 객체**에서
  나오므로 어긋날 수가 없다 (`create_jwt_token`이 하나를 만들어 쿠키에 싣고 그대로 반환)
- `user_`와 `admin_`은 완전히 독립된 세션이다. 동시에 둘 다 살아있을 수 있다.
- 백엔드가 필드를 추가하면 `UserInfo`도 같이 고칠 것.
- **refresh는 쓸 때마다 로테이션된다.** 갱신하면 옛 토큰이 죽고, 죽은 토큰이 다시 오면
  유출로 보고 그 계정의 모든 세션을 끊는다(`SESSION_REUSE_DETECTED`). 자세한 건
  `backend/CLAUDE.md`의 "세션 무효화".
- **`errorCode`는 상수로 비교한다** — 백엔드 `core/utils/error_code.py` ↔ 프론트
  `types/errorCode.ts`가 1:1이다. 문자열 리터럴을 쓰면 오타가 조용히 통과한다.

**무한 새로고침 주의** — 이 템플릿에서 반복적으로 터졌던 버그다. `user_info` 쿠키가 남아있으면 프론트는 로그인 상태로 믿는데, 토큰이 무효라 API는 401을 준다. 이때 전체 새로고침(`location.reload()` / 같은 URL로 `location.href` 대입)을 하면 쿠키가 그대로라 루프가 돈다.

- 세션 실패 시 **절대 페이지를 새로고침하지 말 것.** `syncAuth()` / `refreshAuth()`로 상태만 갱신한다.
- refresh가 실패하면 `user_info`·`refresh_exp` 쿠키를 지워서 로그인 상태를 확실히 해제한다.
- refresh 재시도는 마운트/요청당 1회로 제한한다.

## 작업 원칙

1. Phase 단위로 작업. 한 번에 여러 Phase 수행 금지.
2. 매 Phase 완료 시 `PROGRESS.md` 업데이트 후 커밋.
3. 테스트 통과 후 다음 Phase 진행.
4. 불확실하면 멈추고 질문.
5. 과도한 추상화 금지.

**검증 명령** (Phase 완료 전 실행):

```bash
cd backend  && uv run ruff check .                   # 린트
cd backend  && uv run pytest                         # 라우터를 건드렸다면
cd frontend && npm run check:types && npm run lint
cd frontend && npm test                              # vitest
cd frontend && npm run build
```

이 다섯 줄이 `.github/workflows/ci.yml`이 돌리는 것과 같다 — 푸시 전에 여기서 걸러내면
CI에서 다시 볼 일이 없다.

도메인 라우터를 하나 끝낼 때마다 `/test {도메인}` 으로 엣지 케이스까지 테스트를 붙인다.
테스트가 앱 코드의 버그를 잡으면 **테스트를 느슨하게 고치지 말고 앱을 고친다.**

## Claude Code 설정

| | |
| --- | --- |
| `.claude/commands/` | `/feature` `/design` `/fullstack` `/fix` `/test` · `/setup`(clone 직후 1회) · `/seo_check`(푸시 전) |
| `.claude/agents/` | 탐색·작성 전담 서브에이전트 7종 |
| `.claude/skills/seo/` | SEO·AEO·GEO·LLMO·NEO 진단·구현 ([원본](https://github.com/leopard627/fire-your-seo-agency), MIT) |

> **SEO 스킬 주의** — 이 템플릿의 프론트는 CSR이라 `curl`로 받은 HTML에 본문이 없다.
> 검색 노출이 목표면 렌더링 전략(프리렌더/SSR)부터 정해야 하고, 로그인 뒤에서만 쓰는
> 관리자 도구라면 애초에 손댈 필요가 없다. 스킬이 그 선택지를 먼저 제시한다.

## Phase 관리

**시작 순서**: `PROJECT.md`에 기능 정의 작성 → Claude가 Phase 계획 수립 → 사용자 승인 → Phase 1부터 개발

> `PROJECT.md`, `PROGRESS.md`는 템플릿에 없다. 새 프로젝트를 시작할 때 만든다.

**Phase 양식** (`PROJECT.md`):

```markdown
## Phase N: [이름]

**목표**: ...
**수행 내용**: ...
**완료 기준**: - [ ] ...
**커밋**: `N단계: [설명]`
```

**진행 기록 양식** (`PROGRESS.md`):

```markdown
## N 단계: [이름]

- 상태: ⬜ 대기 / 🔄 진행중 / ✅ 완료 / ❌ 실패
- 완료 시각:
- 수행 내용:
- 이슈/메모:
```

## 배포

`deploy/` — nginx(`nginx.conf` + `site.conf`) · systemd(`fastapi.service`) · 배포 절차(`README.md`).
`CHANGE` 표시만 채우면 된다. `/setup` 이 같이 훑어준다.

**먼저 정할 것 — TLS 를 누가 끝내는가.** Cloudflare / AWS ALB / EC2 직접(certbot)에 따라
nginx 가 443 을 듣는지가 갈린다.

> ⚠️ **어느 형태든 HTTP→HTTPS 리다이렉트가 반드시 있어야 한다.** 없으면 평문으로 들어온
> 사용자에게 `Secure` 쿠키가 저장되지 않아 **"로그인은 200인데 세션이 안 잡힘"** 이 난다.
> 앞단이 TLS 를 끝내면 nginx 는 이걸 모르므로 앞단에서 켠다 (CF: Always Use HTTPS / ALB: 리스너 규칙).

- **`fastapi.service` 의 `APP_ENV=prod`** — 없으면 호스트명 추측으로 떨어져 쿠키가 통째로 어긋난다.
  기동 로그의 `설정: env=prod (근거: APP_ENV)` 로 확인
- **`X-Forwarded-For` 프록시 헤더가 레이트리밋의 전제다.** 없으면 모든 방문자가
  `127.0.0.1` 하나로 뭉쳐서 서비스 전체가 한 한도로 묶인다
- **`location /api/auth` 를 `/auth` 로 적지 말 것** — 실제 라우트는 `/api/auth/**` 라
  매칭되지 않고, 로그인에 빡센 한도가 안 걸린 채 조용히 지나간다
- `client_max_body_size` 는 `upload.py` 의 `MAX_UPLOAD_BYTES` 보다 넉넉해야 한다
- `--workers` 를 올리지 말 것 — 파일 로그 로테이션이 충돌한다 (`fastapi.service` 주석)

## 새 프로젝트로 가져갈 때 교체할 것

| 위치                                      | 내용                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `backend/.env` / `frontend/.env`          | DB·JWT·OAuth 키 전부. **`jwt_secret`·`hash_key`는 프로젝트마다 새로 생성할 것**                                    |
| `backend/.env` → `prod_domain`            | 운영 도메인 (`gnaak.com`). CORS 오리진과 쿠키 도메인이 여기서 유도된다                                             |
| `frontend/.env.production`                | `VITE_APP_PUBLIC_BASE_URL`이 비어 있음                                                                             |
| `frontend/src/container/admin/layout.tsx` | `adminMenu` 샘플 메뉴                                                                                              |

**배포 시 `APP_ENV=prod`를 반드시 명시할 것.** 안 주면 호스트명으로 추측하는데, 이 추측은 EC2
기본 호스트명에서만 맞는다. Docker·Cloud Run에 올리면 조용히 `local`로 떨어져서 쿠키가
`secure=False` / `SameSite=Lax`로 나가고 세션이 안 잡힌다. 기동 로그에 인식된 env와 쿠키 설정이
찍히니 배포 후 한 번 확인할 것.

**로컬 개발 시**: 프론트와 백엔드 호스트를 반드시 통일할 것 (`localhost`끼리 또는 `127.0.0.1`끼리). 섞으면 cross-site가 돼서 `SameSite=Lax` 쿠키가 안 실리고, 로그인은 성공하는데 세션이 안 잡히는 증상이 난다.

MySQL·Redis는 `docker compose up -d` 로 띄운다 (루트 `docker-compose.yml`). DB 두 개(`db_example`, `db_base_test`)가 자동 생성되고 값은 `backend/.env.example`과 맞춰져 있다. 직접 설치한 것을 써도 되지만 `backend/.env`의 `local_*` 값과 맞아야 한다 — 서버가 기동 시 연결을 검증(fail-fast)하고, 실패하면 원인을 로그에 남기고 그대로 종료된다.

## 트러블슈팅

| 상황                            | 대응                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| 로그인은 200인데 세션이 안 잡힘 | 쿠키 자체가 저장됐는지 확인 (도메인·SameSite·호스트 불일치)          |
| 무한 새로고침 / 401 반복        | 위 "무한 새로고침 주의" 참고. `user_info` 쿠키가 남아있는지부터 확인 |
| 갑자기 429가 뜸                 | 로그인 빈도 제한. IP 10회/분 · 계정 5회 실패/10분 (`core/utils/rate_limit.py`) |
| 로그인했는데 곧 401 `SESSION_REVOKED` | 비번 변경·계정 정지로 전체 세션이 끊겼거나, refresh 토큰이 이미 로테이션됨 |
| 401 `SESSION_REUSE_DETECTED`    | 죽은 refresh 토큰이 다시 왔다 = 유출 신호. 전체 세션이 종료된 상태     |
| `/docs`가 비어 보임             | 라우터가 `p.request.json()`을 쓰고 있거나 `response_model`이 없다      |
| 외부 API 키 없음                | mock 데이터로 fallback, 키 확보 후 교체                              |
| 테스트 실패                     | 원인 파악 후 수정. 우회 금지                                         |
| 불명확한 요구사항               | 추측 말고 질문 후 진행                                               |
| 예상치 못한 파일 발견           | 삭제 전 반드시 확인 요청                                             |
