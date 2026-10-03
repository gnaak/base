# 빼기 — 구글 · 카카오 로그인 (OAuth)

로그인이 이메일(또는 사내 계정)뿐일 때. **하나만 뺄 수도 있다** — 표의 범위: `G` 구글 · `K` 카카오 · `공통`(둘 다 뺄 때만).
줄 번호 대신 파일과 이름으로 적는다 — 찾을 때는 이름으로 Grep.
(시험 적용: 둘 다 빼고 pytest · ruff · 타입 · 디자인 린트 · vitest · 빌드 · terraform validate/test 통과)

## 먼저 볼 것 — 해당하면 빼지 말고 멈춘다

- **둘 다 빼면 일반 사용자가 로그인할 길이 없다.** 템플릿에는 사용자용 이메일 로그인 화면이 없다 (관리자 로그인만).
  로그아웃 상태로 사용자 페이지에 가면 `PrivateRoute` 가 `/` 로 보내는데, 거기에 로그인 수단이 없으면 막다른 길이다 —
  **E2E 는 이걸 못 잡는다** (`loginNewUser` 가 API 로 로그인한다). PRD · phase 에 대신할 로그인 방식(이메일 로그인 화면 등)이 있어야 한다.
  없으면 무인 실행은 `DECISIONS.md` ⛔ 에 올리고 넘어간다
- **이미 OAuth 로 가입한 사용자는 비밀번호가 없다** (`tb_users.password` NULL). 빼면 그 사람들은 로그인할 방법이 없다 —
  템플릿에 비밀번호 설정 · 재설정 기능이 없다. 운영 데이터가 있는 프로젝트면 사람에게 묻는다
- DB 컬럼(`password` nullable · `profile_image`)은 **그대로 둔다** (`SKILL.md` 원칙 3)

## 0. 로컬 키부터 지운다

`RawEnv` 는 모르는 키를 거부한다. 아래에서 설정 필드를 지우는 순간 `.env` 에 키가 남아 있으면 **pytest 도 앱도 바로 기동 거부**다.
`unset` 은 설정을 불러오지 않으므로 먼저 해도 된다 (`PP` = `uv --directory backend run python -m scripts.prepare_local` — 값을 보지 않고 줄만 지운다).

```bash
PP unset kakao_client_id ; PP unset kakao_client_secret ; PP unset local_kakao_redirect_uri ; PP unset prod_kakao_redirect_uri     # K
PP unset google_client_id ; PP unset google_client_secret ; PP unset local_google_redirect_uri ; PP unset prod_google_redirect_uri # G
PP unset VITE_APP_PUBLIC_KAKAO_REST_API_KEY --file frontend/.env ; PP unset VITE_APP_PUBLIC_KAKAO_REDIRECT_URI --file frontend/.env    # K
PP unset VITE_APP_PUBLIC_GOOGLE_CLIENT_ID --file frontend/.env ; PP unset VITE_APP_PUBLIC_GOOGLE_REDIRECT_URI --file frontend/.env     # G
```

## 백엔드

| 파일 | 할 일 | 범위 |
| --- | --- | --- |
| `backend/app/module/infra/google/` · `kakao/` | 폴더 삭제 | G · K |
| `module/auth/auth_router.py` | `POST /google` · `POST /kakao` 라우트. 둘 다면 import 의 `OAuthCodeIn` 도 (남기면 ruff 실패) | G · K · 공통 |
| `module/auth/auth_schema.py` | `OAuthCodeIn` | 공통 |
| `core/provider/http/service.py` | `_google_service` · `_kakao_service` 슬롯과 property — **lazy import 라 남겨도 아무 데서도 안 깨진다**. 꼭 지운다 | G · K |
| `core/config/settings.py` | `RawEnv` 의 `google_*` · `kakao_*` 필드(redirect_uri 포함) · `Settings` 의 property(`kakao_redirect_uri` · `google_redirect_uri` 포함) | G · K |
| `module/user/user_repository.py` | `get_or_create_oauth_user` + 그것만 쓰는 import(`ErrorCode` · `fail`) | 공통 |
| `core/utils/error_code.py` ↔ `frontend/src/types/errorCode.ts` | `OAUTH_*` — 양쪽 같이 | 공통 |
| `core/middleware/request_id.py` | `SENSITIVE_QUERY_KEYS` 의 주석 "(OAuth code 등)" — **키 목록은 그대로** (가리는 건 계속 필요) | 공통 |
| `backend/.env.example` | kakao · google 블록 | G · K |
| `tests/test_oauth_router.py` | 둘 다면 파일 삭제. 하나만이면 그 업체 테스트만 — **계정 연결 테스트는 카카오 엔드포인트로 돈다**, 카카오를 빼면 구글로 옮긴다 | |
| `tests/test_auth_router.py` | `/api/auth/google` 을 부르는 테스트 — 구글만 빼면 `/kakao` 로, 둘 다면 삭제. "비밀번호 없는 OAuth 계정" 테스트는 **지우지 말고 이름만** ("비밀번호 없는 계정") — 컬럼이 nullable 로 남는다 | G · 공통 |
| 주석 | `auth_service.py` · `auth_token.py` · `rate_limit.py` · `http_client.py` 예시 · `pyproject.toml` 의 httpx 주석 (**httpx 는 지우지 않는다** — `http_client` 가 쓴다) | |

## 프론트

| 파일 | 할 일 | 범위 |
| --- | --- | --- |
| `src/App.tsx` | import · 라우트 `/google/login` · `/kakao/login` | G · K |
| `src/container/client/auth/google.tsx` · `kakao.tsx` | 삭제 | G · K |
| `src/hooks/auth/googleLogin.tsx` · `googleCallback.tsx` / `kakaoLogin.tsx` · `kakaoCallback.tsx` | 삭제 | G / K |
| `src/hooks/auth/oauthState.ts` · `oauthState.test.ts` | 둘 다면 삭제 (`safeNext` 도 이 파일 안에서만 쓴다). 하나만이면 그대로 (provider 타입을 좁히면 test 도 고쳐야 `check:types` 통과) | 공통 |
| `src/assets/client/login/google.svg` · `kakao.svg` | 삭제 | G · K |
| `src/container/client/main.tsx` | 버튼 import · 사용. 둘 다면 "소셜 로그인" 소개 항목과 로그인 카드를 PRD 의 로그인 방식으로 (PRD 가 없으면 자리표시) · 헤드라인의 "로그인부터 준비돼 있어요" 같은 문구도 | G · K · 공통 |
| `e2e/client.spec.ts` | 로그인 버튼을 확인하는 줄. 둘째 테스트가 "시작하기" 제목을 본다 — 로그인 카드를 바꾸면 같이 | G · K · 공통 |
| `tailwind.config.js` | `kakao` · `google` 색 토큰 — **클래스를 다 지운 뒤에** (먼저 지우면 디자인 린트 실패) | G · K |
| `.env.example` · `.env.production.example` | `VITE_APP_PUBLIC_KAKAO_*` · `VITE_APP_PUBLIC_GOOGLE_*` | G · K |
| `DESIGN.md` · `eslint.config.js` 주석 | 브랜드 버튼 색 | 공통 |

## 인프라

| 파일 | 할 일 |
| --- | --- |
| `infra/server.tf` | `prod_kakao_redirect_uri` · `prod_google_redirect_uri` SSM 값 |
| `infra/github.tf` | 프론트 redirect SSM 값 — **server.tf 와 같이** (한쪽만 지우면 `terraform validate` 실패) |
| `infra/README.md` · `main.tf` · `variables.tf` · `terraform.tfvars.example` · `server/deploy.sh` | OAuth 키 안내 · 주석 |

**운영 Parameter Store — 사람이 한다.** `/<project>/backend/{kakao,google}_*` · `/<project>/frontend/VITE_APP_PUBLIC_{KAKAO,GOOGLE}_*` 삭제 →
`./infra/tf.ps1 apply`(redirect 값) → **그다음에 푸시.** 반대면 새 릴리스가 기동 거부 → 자동 롤백 · CI 빨강.
무인 실행이면 이 목록을 `DECISIONS.md` 🧑 에 적는다. (CI 는 `.env.example` 을 복사해 쓴다 — 거기 남기면 CI 가 실패해서 알 수 있다)

## 문서 · 스킬 · 에이전트

`README.md`(맨 위 소개 · 들어 있는 것 표 — 둘 다 빼면 "없음" 열에 사용자 로그인 화면) · `CLAUDE.md` · `backend/CLAUDE.md` · `frontend/CLAUDE.md` ·
`docs/guides/index.html`(소셜 로그인 절) + `06-kakao-login.html` · `07-google-login.html` + `img/README.md` 의 06-* · 07-* 행 ·
`skills/security/SKILL.md`(frontmatter description 의 "OAuth state · 이메일 검증" · 3단계 — 뒤 단계 번호를 당긴다) + `references/oauth.md` 삭제(둘 다일 때) ·
`skills/deploy/SKILL.md` · `commands/setup.md` · `plan.md`(인터뷰) ·
에이전트 `plan-researcher` · `prd-writer` · `page-mapper` · `fe-ui-builder` · `fe-api-connector` · `be-external-api` · `be-api-builder`("로그인·OAuth·비번재설정")

## 남겨 두는 것

- nginx `location /api/auth` · `auth_limit` — 이메일 로그인 · refresh 도 이 한도를 쓴다
- `frontend/index.html` 의 `google-site-verification` · `deploy/site.conf` 의 "구글이 soft 404" — 검색(SEO) 이야기다
- `commands/start.md` 의 인터뷰 질문(고객이 어떤 로그인을 원하는지) — 다음 프로젝트를 위한 질문이다
- `page-mapper.md` 의 "PG 창 · 카카오 동의" — 화면 흐름의 일반 예시
- `tb_users.password`(nullable) · `profile_image`

## 확인

```bash
# 둘 다 뺐을 때 — 아무것도 안 나와야 한다 (하나만 뺐으면 그 업체 이름만 남기고)
git grep --untracked -n -i -E "kakao|google|oauth|카카오|구글|소셜 로그인" -- . ':!CHANGELOG.md' ':!need.md' ':!backend/uv.lock' ':!frontend/package-lock.json' ':!.claude/skills/seo' ':!.claude/skills/modules' \
  | grep -v -E "google-site-verification|NOAUTH|카카오톡|soft 404|commands/start\.md|PG 창"
git ls-files --others --cached --exclude-standard backend/app frontend/src | grep -i -E "google|kakao|oauth"
PP line kakao_client_id ; PP line google_client_id   # "줄이 없습니다" 여야 한다 — 빈 값으로 남은 키는 기동 거부가 안 나서 놓친다
# lazy property 가 지운 모듈을 가리키지 않는지 — 전부 한 번씩 불러 본다
uv --directory backend run python -c "from app.core.provider.http.service import ServiceProvider as S; p=S(None,None); [getattr(p,n) for n,v in vars(S).items() if isinstance(v,property)]; print('ok')"
```

그리고 루트 `CLAUDE.md` 의 검증 명령 전부 (pytest · 타입 · 린트 · vitest · 빌드 · E2E).
