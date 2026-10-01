# Base Template — CLAUDE.md

풀스택 프로젝트 베이스 템플릿. 세부 규칙은 `frontend/CLAUDE.md`, `backend/CLAUDE.md` 참고.

## 기술 스택

| 영역     | 기술                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| Frontend | React 19 + TypeScript + Vite 6 + TanStack Query v5 + Tailwind CSS v3 + react-router v7 |
| Backend  | FastAPI + SQLAlchemy 2.0 (async) + MySQL(aiomysql) + Redis + Alembic                   |
| 인증     | 쿠키 기반 JWT + OAuth (Google, Kakao)                                                  |
| 도구     | uv(파이썬·의존성) + ruff · vitest · GitHub Actions                                      |
| 인프라   | Terraform(EC2·RDS·S3·Cloudflare) + cloud-init + SSM — Docker 없이 nginx·systemd 직접      |

**백엔드는 `uv` 를 쓴다. `pip` · `python -m venv` 는 쓰지 않는다.** 의존성은
`backend/pyproject.toml` 에 선언하고 `uv.lock` 이 버전을 잡는다. 명령 앞에 `uv run` 을
붙이면 되고 activate 는 필요 없다. 자세한 건 `backend/CLAUDE.md` 의 "의존성 관리 — uv".

**디자인은 `DESIGN.md` 를 먼저 읽는다.** 색·간격·깊이가 전부 토큰이라 직접 색을 쓰면
다크모드가 따라오지 않는다.

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

1. phase 단위로 작업. 한 번에 여러 phase 수행 금지.
2. 매 phase 완료 시 `PROGRESS.md` 업데이트 후 커밋.
3. 테스트 통과 후 다음 phase 진행.
4. 불확실하면 멈추고 질문.
5. 과도한 추상화 금지.

**검증 명령** (phase 완료 전 실행):

```bash
cd backend  && uv run ruff check .                   # 린트
cd backend  && uv run pytest                         # 라우터를 건드렸다면
cd frontend && npm run check:types && npm run lint
cd frontend && npm test                              # vitest
cd frontend && npm run build
./infra/.bin/<버전>/terraform -chdir=infra test     # infra/ 를 건드렸다면 (키 불필요, mock)
```

이 줄들이 `.github/workflows/ci.yml`이 돌리는 것과 같다 — 푸시 전에 여기서 걸러내면
CI에서 다시 볼 일이 없다. (terraform 은 `./infra/tf.ps1` 을 한 번 부르면 `infra/.bin/` 에 받아진다)

도메인 라우터를 하나 끝낼 때마다 `/test {도메인}` 으로 엣지 케이스까지 테스트를 붙인다.
테스트가 앱 코드의 버그를 잡으면 **테스트를 느슨하게 고치지 말고 앱을 고친다.**

## Claude Code 설정

| | |
| --- | --- |
| `.claude/commands/` | `/setup`(clone 직후 1회) → `/plan`(기획 1회) → `/feature` `/design` `/fullstack` `/fix` `/test` · `/seo_check`(푸시 전) |
| `.claude/agents/` | 단계별 서브에이전트 — `plan/`(리서치·PRD·페이지 맵·디자인) · `dev/backend/`(탐색·모델·API·**외부 연동**) · `dev/frontend/`(탐색·작성) · `verify/`(테스트 작성) |
| `.claude/skills/seo/` | SEO·AEO·GEO·LLMO·NEO 진단·구현 ([원본](https://github.com/leopard627/fire-your-seo-agency), MIT) |

> **에이전트 파일 규칙** — 폴더는 사람이 보기 위한 정리일 뿐, Claude는 `description` 만 보고 고른다.
> 도구 제한은 **`tools:`** 필드다. `allowed-tools:`(커맨드·스킬용)를 쓰면 조용히 무시되고 모든 도구가 열린다.
> 탐색 전담은 `Read, Grep, Glob` 만 — "터미널 금지"를 프롬프트에 적는 것보다 도구를 빼는 게 확실하다.
> 모델은 **판단·설계·검토 = `opus`**(DB 모델링, API 로직, PRD, 리뷰어), **탐색·대량 작성 = `sonnet`**. haiku 는 쓰지 않는다 —
> 탐색이 틀리면 뒤 단계가 전부 틀린다. 별칭(`opus`/`sonnet`)은 그 계열의 최신 모델을 따라간다.
> 에이전트 파일은 고친 뒤 **반영까지 몇 분 걸릴 수 있다** (커맨드는 바로 반영된다). 그 사이 호출하면 옛 정의로 돈다 —
> 도구 제한을 확인하려면 에이전트에게 "지금 가진 도구 목록만 답하라"고 시켜 본다.

> **SEO 스킬 주의** — 이 템플릿의 프론트는 CSR이라 `curl`로 받은 HTML에 본문이 없다.
> 검색 노출이 목표면 렌더링 전략(프리렌더/SSR)부터 정해야 하고, 로그인 뒤에서만 쓰는
> 관리자 도구라면 애초에 손댈 필요가 없다. 스킬이 그 선택지를 먼저 제시한다.

## phase 관리

**시작 순서**: `/plan {아이디어}` → 인터뷰(사람이 붙는 유일한 곳) → 외부 리서치 → `PRD/02_PRD.md` →
`03_PAGE.md`(페이지 맵) · `04_DESIGN.md`(고객 화면 테마) → `PROJECT.md`·`PROGRESS.md`·`DECISIONS.md` → phase 1부터 개발

**무인으로 돈다 — 결정은 멈추지 않고 기록한다.**
- **되돌리기 쉬운 결정은 기본값으로 진행한다.** 디자인 방향이 그렇다 — 후보를 전부 테마로 저장하고 기본값을 자동으로 고른다.
  사람은 실제 화면에서 `data-theme` 만 바꿔 보며 고른다
- **되돌리기 어려운 결정(돈·법·범위)도 기본값으로 진행하되 `DECISIONS.md` 에 올린다.** 기본값은 더 안전한 쪽
  (소비자 보호·개인정보 최소·플랫폼 손실 상한). 사람은 아침에 `DECISIONS.md` 를 보고 바꾼다
- **그래서 결정 지점은 설정값으로 구현한다.** 수수료율·마감 시각·실패 허용 횟수처럼 PRD 의 U\* 에 걸린 값은
  하드코딩하지 말고 기본값을 가진 설정(`RawEnv` 필드 → 운영은 SSM `/<project>/backend/*`)으로 둔다 —
  아침의 결정이 코드 수정이 아니라 값 하나가 되게. 데이터 구조가 갈리는 "구조" U 만 다시 개발이 필요하다
- **무인으로 넘지 않는 선**: 실제 결제 키, 운영 배포, main merge. 무인 개발은 브랜치·테스트 키·로컬 DB 까지만 간다

> `PRD/`, `PROJECT.md`, `PROGRESS.md`, `DECISIONS.md` 는 템플릿에 없다. 새 프로젝트에서 `/plan` 이 만든다.
> 기획이 이미 끝나 있으면 아래 양식대로 `PROJECT.md` 를 직접 써도 된다.

- **완료 기준은 PRD 의 문장을 ID 째로 옮긴다** (`F3-2 ...`). 검증 단계가 이 문장을 그대로 대조하므로
  phase 를 짜면서 바꿔 쓰지 않는다. 바꿔야 하면 `PRD/02_PRD.md` 부터 고친다
- **PRD 는 결정, 엣지 케이스는 개발** — 코드를 봐도 답이 없는 것(권한·돈·법·범위)만 완료 기준이 된다.
  타임아웃·재시도·상태값 같은 구현 엣지 케이스는 PRD 12장 → phase 의 "개발에서 다룰 것" → `/test` 로 간다.
  기획이 구현까지 정하려 들면 PRD 가 명세서가 되고, 코드를 모르고 정한 내용이라 결국 다시 쓴다
- **phase 1 "디자인 기반"** — 템플릿의 `DESIGN.md` 는 관리자(콘솔)용이다. 고객 화면은 프로젝트마다 업종 리서치로
  후보 테마를 만들고(`04_DESIGN.md`), phase 1 에서 `.theme-client[data-theme]` 범위로 토큰을 덮어쓴다.
  테마 전환은 고객 레이아웃의 `data-theme` 값 하나. 관리자 화면은 그대로 둔다
- **phase 0 "준비"** 는 개발이 아니라 사람이 할 일이다 — PG·알림톡 심사, 사업자·인허가처럼 코드 밖에서
  리드타임이 긴 것. 개발보다 먼저 시작해야 일정이 안 밀린다. 무인 개발은 phase 0 을 기다리지 않고 테스트 키로 간다

**phase 양식** (`PROJECT.md`):

```markdown
## phase N: [이름]

**목표**: ...
**기능**: F1, F3 (`PRD/02_PRD.md`)
**페이지**: P2, P5 (`PRD/03_PAGE.md`)
**설정값**: U1(수수료 비율), U4(마감 시각) — 하드코딩 금지, 기본값을 가진 설정으로
**수행 내용**: ...
**완료 기준**: - [ ] F1-1 ... (PRD 5장 문장 그대로)
**개발에서 다룰 것**: PRD 12장 항목 — 완료 기준이 아니라 `/test` 가 덮을 엣지 케이스
**커밋**: `feat: [설명]`   ← 영역 접두사 (feat · fix · refactor · docs · infra)
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

**자동 배포 — `infra/README.md`.** Terraform 이 EC2·RDS·S3·IAM·앞단을 만들고, main 에 푸시하면
CI 가 테스트 → 빌드 → S3 → SSM 으로 서버의 `infra/server/deploy.sh` 를 돌린다.
구성은 **앞단 → EC2(nginx + 앱 + Redis) → RDS**. 앞단은 `terraform.tfvars` 의 **`edge`** 하나로 고른다:
`cloudflare`(기본, 무료 — CF DNS · Origin 인증서 · Full strict) / `aws`(Route 53 · ALB · ACM).
서버·nginx 설정은 둘 다 같다 — 갈리는 건 `cloudflare.tf` ↔ `aws_edge.tf` 와 deploy.sh 의 real_ip 뿐.

- **키는 내 PC 의 `infra/.env` 에만** 있다. 서버는 IAM Role, CI 는 OIDC — GitHub Secrets 에 AWS 키가 없다.
  `infra/.env` 를 `backend/.env` 와 합치지 말 것 (그건 서버로 가는 파일이다)
- terraform 은 설치하지 않는다 — `./infra/tf.ps1` 이 `.terraform-version` 을 받아 쓴다
- **운영 `backend/.env` 는 손으로 만들지 않는다.** 배포마다 SSM `/<project>/backend/*` 에서 새로 만든다.
  OAuth 키 등은 Parameter Store 에 넣는다 (이름이 `RawEnv` 필드와 다르면 기동 거부)
- AWS 연결 전(템플릿 그대로)에는 CI 의 `deploy` 잡이 **건너뛴다** — 실패가 아니다
- EC2 는 교체되지 않게 막혀 있다 (Redis 에 세션 무효화 상태가 있다). 교체되면 `jwt_secret` 이 같이 바뀐다
- 앱이 서버에 쓰는 폴더를 추가하면 `deploy.sh` 의 `keep` + `fastapi.service` 의 `ReadWritePaths` 둘 다에
- ⚠️ 앱 레이트리밋은 `CF-Connecting-IP` 를 1순위로 믿는다. CF 는 이 헤더를 덮어쓰지만 **ALB 는 사용자 값을
  그대로 넘긴다** — `edge=aws` 에서 nginx 가 덮어쓰는 줄(`edge-realip.conf`)을 지우면 위조로 한도가 뚫린다

`deploy/` — nginx(`nginx.conf` + `site.conf`) · systemd(`fastapi.service`) · 수동 배포 절차(`README.md`).
자동 배포는 이 파일들을 **자리표시만 바꿔서** 그대로 깐다 — 설정을 바꾸려면 여기를 고치고 푸시한다.
systemd 파일에는 **줄 끝 주석을 쓰지 말 것** (`User=ubuntu  # 설명` 이 사용자 이름이 되어 기동 실패).

**손으로 올린다면 먼저 정할 것 — TLS 를 누가 끝내는가.** Cloudflare / AWS ALB / EC2 직접(certbot)에 따라
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
| `backend/.env` / `frontend/.env`          | DB·JWT·OAuth 키 전부. **`jwt_secret`·`hash_key`는 프로젝트마다 새로 생성할 것** (로컬용. 운영 값은 SSM — 자동 생성) |
| `infra/terraform.tfvars` / `infra/.env`   | 프로젝트명·계정 ID·도메인·저장소 / AWS 키·CF 토큰. `infra/README.md` 의 "1회 준비"                                  |
| `backend/.env` → `prod_domain`            | 운영 도메인 (`gnaak.com`). CORS 오리진과 쿠키 도메인이 여기서 유도된다                                             |
| `frontend/.env.production`                | `VITE_APP_PUBLIC_BASE_URL`이 비어 있음                                                                             |
| `frontend/src/container/admin/layout.tsx` | `adminMenu` 샘플 메뉴                                                                                              |
| `frontend/src/container/admin/main.tsx`   | 샘플 대시보드 (`SAMPLE_USERS` 더미 데이터). 지우고 실제 화면으로                                                   |
| `frontend/src/index.css`                  | 브랜드 색. **CSS 변수만 고치면 된다** — `tailwind.config.js`는 그 변수를 가리킬 뿐. 값은 공백 구분 RGB (`37 99 235`) |
| `frontend/index.html`                     | `BASE` · `example.com` — title·description·OG·canonical·JSON-LD. `/setup`이 채워준다                               |

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
