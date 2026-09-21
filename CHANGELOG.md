# CHANGELOG — 왜 이렇게 바뀌었나

"뭐가 바뀌었다"는 `git log`가 안다. 이 파일은 **왜 그렇게 바꿨고, 그 과정에서 뭘 배웠는지**를 남긴다.
나중에 다시 봤을 때 "아 이거 왜 이렇게 해놨지"가 안 나오게.

각 항목은 **기존 → 변경 → 왜** 순서다. 마지막에 그때 걸린 함정이 있으면 **함정** 으로 적는다.
문제 목록과 우선순위 판단은 [`need.md`](need.md)에, 이 파일은 그 결과다.

---

## 2026-09-21

### 문서 진입점 + 이 파일 — `071ea6e`

루트 `CLAUDE.md`에 uv·디자인 시스템 진입점 추가. "새 프로젝트로 가져갈 때 교체할 것"에
빠져 있던 `index.css`(브랜드 색) · `index.html`(플레이스홀더) · `main.tsx`(샘플 대시보드) 보강.
그리고 이 `CHANGELOG.md` — `need.md`가 "뭐가 문제였나"라면 여기는 "그래서 왜 이렇게 했나".

---

## 2026-09-20

### uv 전환 — `a7cd5f0`

**기존** `requirements.txt` freeze + `python -m venv` + `pip install`.
**변경** `pyproject.toml`(선언) + `uv.lock`(해석 결과) + `.python-version`(3.12). `uv sync` 하나로 끝.
**왜**
- freeze는 "내 윈도우에서 풀린 결과"라 리눅스 서버에서 같은 트리가 나온다는 보장이 없었다. `uv.lock`은 플랫폼별 해시까지 든다
- 파이썬 인터프리터 버전이 아예 관리 대상이 아니었다. 이제 없으면 uv가 받아온다
- ruff·pytest·의존성이 한 파일에 모인다

그룹 3개: 기본(운영) / `dev`(pytest·fakeredis·ruff) / `prod`(gunicorn). 서버·CI·Docker는 전부 `--frozen` — lock을 다시 풀지 않으니 배포 때 조용히 버전이 오르지 않는다.

**함정**
- `deploy/fastapi.service`가 gunicorn을 실행하는데 **gunicorn이 어디에도 선언돼 있지 않았다.** requirements.txt에도 없었으니 그 유닛 그대로 쓰면 기동 실패. `prod` 그룹으로 편입
- `>=` 하한으로 선언하니 `uv lock`이 전부 최신을 물었다 — redis 7.3→8.1, starlette 1.0→1.6, uvicorn 0.42→0.53, pydantic 2.12→2.13. 테스트 84개 + CI로 검증됐지만 의도한 것보다 큰 점프. 문제 생기면 `uv.lock`만 되돌리면 된다
- ruff `target-version`을 py312로 올리니 UP046이 `BaseResponse(BaseModel, Generic[T])`를 PEP 695로 바꾸라 함. uv와 무관한 리팩터라 py311 유지

### 어드민 디자인 시스템 — `521bbbe`

**기존** 어드민 레이아웃이 `bg-adminMain` `text-textMain`을 쓰고 있었는데 **둘 다 tailwind.config.js에 없는 클래스**였다. 배경색이 통째로 안 먹고 있었던 것. 상단 헤더 + 사이드바 구성.
**변경** chatbase.kr에서 다듬은 Vercel 계열 토큰을 통째로 이식. `index.css` CSS 변수(라이트 + `.dark`) → `tailwind.config.js`가 노출. Geist/Geist Mono 가변 폰트 동봉. 헤더 제거하고 사이드바 단독.
**왜** 기존 화면이 낡았고, 파생 프로젝트에서 매번 디자인을 다시 잡고 있었다. 한 번 제대로 만들어서 복사하자는 템플릿 취지 그대로.

핵심 규칙 ([`DESIGN.md`](DESIGN.md)):
- 깊이는 `border`가 아니라 `shadow-border`(1px 링) — 레이아웃 크기를 안 바꿔서 hover에 요소가 안 밀린다
- 색은 정보일 때만. 회색조 기본
- 제목은 음수 트래킹, 숫자는 `tabular-nums`, 로딩은 스켈레톤 (0을 먼저 그리면 숫자가 튄다)

신규 컴포넌트: `StatCard` `Skeleton` `ConfirmModal`. `Table`은 `Row` 제네릭 복원 (chatbase 복사본이 `any`로 되돌려놨었다).

**함정** 없는 Tailwind 클래스는 **에러 없이 조용히 무시된다.** 이번에 발견한 `bg-adminMain`이 그 예. 새 클래스 쓰기 전에 config에 있는지 확인.

---

## 2026-09-19 — 템플릿 감사 (need.md A→B→C)

1년 9개월차가 5~6개월차 때 만든 템플릿을 냉정하게 다시 봤다. 결과가 [`need.md`](need.md).
A(없으면 안 됨) 6개, B(있으면 좋음) 10개, C(정리) 전부 처리. 테스트 14 → 84개.

### A1. 데코레이터 → Annotated 의존성 — `a0634f2`

**기존** `@with_provider` `@with_login` 데코레이터가 엔드포인트를 `(p)` 하나짜리 래퍼로 감쌌다.
**변경** `Provider` / `UserProvider` / `AdminProvider` 타입 별칭 (`Annotated[ServiceProvider, Depends(...)]`). 파라미터 타입 하나에 DI + 인증을 싣는다.
**왜** 래퍼 때문에 FastAPI가 path·query·body 파라미터를 못 봤다. 그 결과:
- `/docs`가 비어 있었다 (operationId 전부 `wrapper_*`)
- 입력 검증이 없어서 깨진 JSON·빈 바디·배열 바디가 전부 **500** — 이제 전부 422

같이 바뀐 것: 로그인 정보가 `p.request.user_id`(Request monkey-patch)에서 `p.auth.user_id`(dataclass)로. 서비스가 Request 대신 값을 받는다 — 검증은 라우터 경계에서 한 번, 서비스는 HTTP를 모른다.

**함정** 이 구조를 처음 만들 땐 코틀린 템플릿을 옮긴 거였다. 데코레이터가 코틀린 어노테이션의 직역이었는데, 파이썬에선 `functools.wraps`가 시그니처를 복원하지 않으면 프레임워크가 함수 안을 못 본다. 파생 프로젝트(xerovatar·soulie·chatbase)는 "잘 동작"했는데, 동작한 게 아니라 **검증 없이 통과**하고 있었던 것.

### A2. 응답도 스키마로 — `0d770f2`

**기존** `success()`가 `JSONResponse`를 직접 만들었다.
**변경** `success()`가 `BaseResponse[T]` 모델을 반환. 라우터에 `response_model=BaseResponse[XxxOut]`.
**왜** 두 가지가 막혀 있었다:
1. `json.dumps`를 그대로 타서 datetime·Decimal이 있으면 TypeError → 500. `get_me()`가 `.isoformat()`을 손으로 부른 이유가 이것이고, 파생 프로젝트엔 `_serialize` / `kst_iso()` 헬퍼로 번져 있었다
2. `JSONResponse`를 반환하면 FastAPI가 손대지 않으므로 `response_model`이 **`/docs`에 뜨기만 하고 검사하지 않는다.** 측정하니 스키마에 없는 `password`가 그대로 새어나갔다

`SessionOut`을 `create_jwt_token()`이 만들어 쿠키에 싣고 그대로 반환 → 쿠키와 응답 `data`가 같은 객체에서 나온다. 어긋날 수가 없다.

**함정** 처음엔 "`response_model`이 무시된다"고 했는데 틀렸다. `/docs`에는 나온다. **강제가 안 될 뿐.** 문서와 실제가 다른 게 없는 것보다 나쁘다.

### A5. 로그인 빈도 제한 — `51fdb58`

**기존** 없음. "앞단(nginx·Cloudflare)이 막는다"고 문서에 써놓고 앞단 설정도 없었다.
**변경** `core/utils/rate_limit.py`. 두 층 — IP×엔드포인트(10회/분) + 계정×실패(5회/10분). 카운터는 Redis.
**왜** 앞단은 IP 기준이라 IP를 바꿔가며 한 계정을 두드리는 크리덴셜 스터핑을 구조적으로 못 막는다.

설계 결정:
- **미들웨어가 아니라 의존성.** 미들웨어는 규칙에 경로 문자열을 적어야 해서 라우터 prefix를 바꾸면 제한이 조용히 풀린다
- 비밀번호 검사 **전에** 계정 잠금을 확인 — 잠긴 계정에 argon2 비용을 안 쓴다. 없는 계정도 실패로 세어 "잠기는지"로 이메일 존재를 못 알아내게
- `X-Forwarded-For`는 peer가 공인 IP가 아닐 때만 믿는다 — 앱 포트가 외부에 열리면 헤더 위조로 우회되니까
- Redis가 죽으면 **통과**(fail-open). 제한이 잠시 풀리는 것보다 모든 로그인이 막히는 게 나쁘다

**함정** chatbase.kr 구현을 참고했는데 4가지가 고장나 있었다: 429가 CORS 헤더 없이 나감 / preflight OPTIONS가 한도를 깎아 실질 한도 절반 / `BaseHTTPMiddleware` deadlock / 429가 `BaseResponse` 계약을 안 지킴. 전부 `fail()` + 의존성으로 바꾸니 자동 해결.

### A6. 세션 무효화 — `8aa22e5`

**기존** JWT는 stateless라 로그아웃·비번 변경·계정 정지를 해도 기존 세션이 만료까지 살아있었다. `active` 컬럼은 선언만 되고 아무도 검사 안 함.
**변경** `module/auth/auth_revoke.py` (Redis).
- 거부 목록(jti): 그 세션 하나 — 로그아웃
- 버전 카운터(ver): 그 계정 전체 — 비번변경·정지
- refresh 로테이션: 쓸 때마다 옛 토큰이 죽는다
- 재사용 탐지: 죽은 토큰이 또 오면 유출로 보고 전체 종료 (`SESSION_REUSE_DETECTED`)

**왜 refresh를 7일로 늘렸나** 로테이션이 있으면 refresh 토큰 하나가 오래 살아도 탈취 시 한 번 쓰면 끝이라 위험이 묶인다. 그래서 "access 15~30분 / refresh 1~2주" 권고가 성립한다. 무효화 확인은 refresh 시점에만 하므로 **무효화 지연 = access 수명** — 이게 access를 짧게 가져가는 진짜 이유.

**함정**
- **로테이션 유예 10초가 핵심.** 탭을 여러 개 열면 각자 refresh를 시도하는데, 유예가 없으면 이 정상 동작이 재사용으로 오판돼 사용자가 통째로 로그아웃된다. 유예 마커를 거부 목록보다 **먼저** 쓰는 순서도 같은 이유
- fail 방향이 두 갈래다. 레이트리밋은 fail-open(가용성), 무효화는 fail-closed(보안). **단 발급 시 버전 조회만 fail-open** — 그건 보안 검사가 아니라 도장 찍기라 Redis 장애로 로그인을 막을 이유가 없다. 테스트 `Redis가_죽어도_로그인은_된다`가 503으로 깨지면서 발견

### A4. SameSite None → Lax — `73d977f`

**기존** prod에서 SameSite를 무조건 `None`으로 덮어썼다.
**변경** `.env`의 `cookie_samesite` (기본 `lax`). 모르는 값이면 Lax로 떨어지고 경고.
**왜** `None`은 "cross-site 요청에도 쿠키를 붙여달라"는 뜻 — 브라우저가 공짜로 해주는 CSRF 방어를 스스로 끄는 값이다. 이 템플릿은 프론트 JS가 `user_info` 쿠키를 직접 읽는 구조라 원래 same-site를 전제한다. `None`은 자기 아키텍처와 모순이었다.

**함정**
- "CORS가 막지 않나?" — 못 막는다. Starlette `request.json()`은 Content-Type을 확인하지 않아서 `text/plain`으로 보내면 preflight 없는 simple request가 돼 통과한다
- "임베드 위젯(chatbase)은 어떡하나?" — Lax면 된다. 위젯이 부르는 API는 `@without_login`이라 쿠키를 안 쓰고, 관리자는 chatbase.kr을 직접 방문하니 same-site. 오히려 `None`이면 관리자로 로그인한 사람이 위젯 달린 고객사 사이트를 볼 때 그 iframe에서 관리자 쿠키가 실려 나간다
- SameSite는 iframe의 origin이 아니라 **최상위 문서의 사이트**를 본다. "iframe이니까 same-origin" 이라는 주석을 믿고 임베드에 인증을 붙이려 하면 헤맨다

### C. 죽은 코드 정리 — `abe6049`

- 프론트: dompurify / highlight.js / lowlight (사용처 0)
- 백엔드: `parse_date()` `register_base()` (참조 0), `isort` (설정도 사용처도 없음)
- `POST /api/auth/signup` 노출 — `SignupIn` 스키마와 `SIGNUP_LIMIT`이 있는데 아무도 안 쓰고 있었다. 지우는 대신 살림. 세션은 안 만든다 (자동 로그인은 프로젝트마다 다른 선택)
- 라우트 가드 중복 제거 — `AdminLayout` 안의 인라인 가드를 걷어내고 `App.tsx`의 `<PrivateRoute authType="admin">` 하나로. 같은 로직이 두 곳에 있어서 고칠 때 양쪽을 봐야 했다

### B7. docker-compose — `e0a33f4`

**기존** README의 "clone 후 .env만 채우면 됨"이 거짓이었다. MySQL 8 + Redis 7을 직접 깔아야 했다.
**변경** `docker-compose.yml` — MySQL·Redis만. 앱은 넣지 않았다.
**왜** 앱을 컨테이너에 넣으면 Windows에서 `C:\`를 바인드 마운트해야 하는데 파일 I/O가 느리고 inotify가 안 넘어와 `--reload`가 안 먹는다. Docker는 **인프라(compose) + 배포(이미지)** 에만.

**함정** healthcheck는 `mysqladmin ping -h 127.0.0.1` (TCP). 소켓 ping이면 초기화 중 임시 서버가 응답해서 `init.sql`이 끝나기 전에 healthy로 잡힌다. CI에서 `service_healthy`로 기다릴 때 중요.

### B8. CI + Dockerfile — `452bc98`

**기존** CLAUDE.md의 "검증 명령"이 사람 기억에 의존.
**변경** `.github/workflows/ci.yml` — backend(pytest) / frontend(types·lint·test·build) / docker(이미지 빌드). push·PR마다.
**왜** 사람이 기억해서 돌리는 것과, 못 돌리면 머지가 막히는 것은 다르다.

Dockerfile은 "파이썬 버전 고정"을 개발 컨테이너가 아니라 배포 이미지에서 푼다. `APP_ENV=prod`를 이미지에 박은 이유 — 컨테이너 호스트명은 EC2 패턴이 아니라 조용히 `local`로 떨어져서 쿠키가 `secure=False`로 나간다.

**함정** lint를 CI에 넣으려고 Table 컴포넌트의 `any` 6개를 제네릭으로 고쳤다. 템플릿의 `any`는 복사해 쓰는 프로젝트마다 그대로 번진다.

### B9~B16 일괄 — `12358ac`

| 항목 | 기존 → 변경 | 왜 |
|---|---|---|
| **ruff** | 린터 없음 → ruff (E W F I UP B C4 SIM, 110자) | 위반 98개 → 0. `B008`은 끈다 — FastAPI `Depends` 기본값은 관용구 |
| **에러코드** | 문자열 리터럴 산재 → `error_code.py` ↔ `errorCode.ts` 1:1 | 오타가 조용히 통과하지 않게 |
| **TimestampMixin** | 모델마다 손으로 → 상속 | `deleted_at`은 자동 필터 **안 한다** — 전역 필터는 통계·복구 쿼리를 막는다 |
| **페이지네이션** | 없음 → `Page[T]` + `paginate()` | 개수 쿼리는 `order_by(None)` — MySQL이 헛정렬 안 하게. 0건이면 `total_pages=1` |
| **업로드** | 없음 → `POST /api/upload/image` | 확장자 화이트리스트 + 스트리밍 용량 검사 + UUID. subdir은 호출부 상수 (클라이언트가 정하면 경로 조작) |
| **프론트 테스트** | 0 → vitest 8개 | `useAPI.ts`의 401→refresh 경로 — "이 템플릿에서 반복적으로 터졌던" 그 지점 |

**함정** 업로드 테스트가 실제 버그를 잡았다. `max_bytes: int = MAX_UPLOAD_BYTES`가 **import 시점에 묶여서** 상수를 바꿔도 반영이 안 됐다. `None`으로 받고 호출 시점에 읽는다. 파이썬 기본 인자는 정의 때 한 번 평가된다.

### 문서·에이전트 정합 + SEO 스킬 이식 — `8377157`

- 루트 CLAUDE.md 쿠키 표가 1h/6h로 굳어 있었다 → `.env`에서 온다는 것 + access 수명이 곧 무효화 지연이라는 것 반영
- `.claude/agents/`, `/feature` `/fullstack` `/test`를 오늘 변경분에 맞춤
- `fire-your-seo-agency`(MIT)를 `.claude/skills/seo/`로. SEO·AEO·GEO·LLMO·NEO 다섯 레인

**함정** 이 템플릿은 CSR이라 `curl`로 받은 HTML에 h1도 본문도 없다. SEO 진단이 거의 다 ❌로 나오는 게 **정상**이고, 메타·JSON-LD만 손봐서는 효과가 없다. 그래서 스킬이 렌더링 전략(그대로 / 프리렌더 / SSR)을 먼저 묻게 했다. 로그인 뒤 관리자 도구면 손댈 필요 없음.

### nginx · /setup · /seo_check · SEO 파일 — `58eba37`

- `deploy/nginx.conf` — 프론트 정적 + `/api` 프록시 + WebSocket. `X-Forwarded-For` 세 줄이 레이트리밋의 전제
- `/setup` — clone 직후 1회. 시크릿→도메인→브랜딩→정리
- `/seo_check` — 조용히 0이 되는 사고만 보는 정적 검사. **CI 게이트 대신 사람이 부르는 방식**으로 정함 (푸시 전에 돌린다)
- `robots.txt` `sitemap.xml` `llms.txt` 뼈대

**함정** `/seo_check`이 `index.html`에서 **다른 프로젝트의 google-site-verification 토큰**을 찾아냈다. 그대로 배포되면 새 프로젝트가 자기 사이트를 소유 확인 못 한다. Apple 로그인 스크립트도 안 쓰는데 모든 페이지에 딸려가고 있었다.

### deploy/ 재구성 — `82c76a9`

**기존** `nginx.conf`에 server{} 블록 하나. TLS를 nginx가 끝내는 구성만 가정.
**변경** `nginx.conf`(http) + `site.conf`(server, TLS 종단 4가지 스위치) + `fastapi.service` + `README.md`. 실제 운영 설정을 참고.
**왜** 이번이 첫 Cloudflare 배포였고, 도메인을 AWS에서 할 수도 있다 — TLS를 누가 끝내느냐에 따라 nginx가 443을 듣는지가 갈린다. 어느 형태든 되게.

운영 설정에서 고친 것:
- `location /auth` → `/api/auth`. prefix는 긴 쪽이 이기므로 `/auth`로 적으면 실제 라우트에 매칭 안 되는 **죽은 블록** — 로그인에 빡센 한도가 안 걸린 채 조용히 지나간다
- `--forwarded-allow-ips="*"` → `127.0.0.1`. bind를 바꾸는 순간 헤더 위조로 레이트리밋 우회
- `--graceful-timeout 0` → `30`. 0이면 배포마다 진행 중 요청이 끊긴다
- `After=network-online.target`. `network.target`만으론 DB보다 먼저 떠서 fail-fast로 죽는다
- `Environment="APP_ENV=prod"` 추가

**함정** soft 404 — 처음엔 "없는 페이지가 200이면 안 된다"고 절대적으로 썼는데, `path="*"`가 NotFound를 그리므로 사람에겐 문제가 없다. 관리자 도구면 200 그대로가 맞고, 공개 검색이 목표일 때만 프리렌더로. 프리렌더 없이 `=404`만 켜면 **모든 라우트가 404**가 된다.

`deploy/`는 설정 원본이지 자동화가 아니다. AMI가 있으면 그대로 쓰고, 여기 값만 옮기면 된다.

---

## 이 과정에서 반복해서 걸린 것

한 줄씩. 다음에 또 걸릴 확률이 높은 순서.

1. **없으면 조용히 지나가는 것들이 제일 위험하다** — 없는 Tailwind 클래스, 매칭 안 되는 nginx location, 강제 안 되는 `response_model`, 선언 안 된 gunicorn. 전부 에러 없이 "동작"했다
2. **"잘 동작한다"와 "검증하고 있다"는 다르다** — 파생 프로젝트들이 잘 돌아간 건 입력 검증이 없어서 뭐든 통과했기 때문
3. **fail-open / fail-closed는 항목마다 따로 정한다** — 가용성이 우선인 것(레이트리밋, 발급 시 버전 조회)과 보안이 우선인 것(무효화 검사)
4. **동시성은 "탭 여러 개"에서 터진다** — refresh 로테이션 유예, 프론트 `pendingRefresh`가 탭 안에서만 중복을 막는다는 것
5. **파이썬 기본 인자는 import 시점에 한 번** — `= MAX_UPLOAD_BYTES`가 상수 변경을 못 따라간다
6. **템플릿의 결함은 복사한 프로젝트 수만큼 번진다** — `any`, `_serialize` 헬퍼, 남의 verification 토큰
