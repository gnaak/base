---
name: start
description: "처음 한 번 — 이 템플릿을 막 받은 사람(개발 도구가 하나도 없어도 된다)이 만들 것을 대화로 정하고, 이 PC 에서 돌아가게 셋업(도구 · DB · 시크릿 · 이름 · git)한 뒤 /plan 으로 넘어간다. 여러 번 다시 쳐도 했던 단계는 건너뛴다. 이미 PROJECT.md 가 있으면 쓰지 않는다."
---

$ARGUMENTS

이 저장소를 막 받은 사람이 `/start` 하나로 **"만들 것 정하기 → 이 PC 에서 돌아가게 → 기획"** 까지 간다.
쓰는 사람은 **개발자가 아닐 수 있다** — 파이썬도 Node 도 없고, 터미널이 뭔지 모를 수 있다고 가정한다.

## 말하는 방식

- 쉬운 말로. 명령어 · 파일 경로는 필요할 때만 보여 주고, 무엇을 하는지 한 줄로 먼저 말한다 ("DB 를 만들게요")
- **사람이 직접 해야 하는 일**(설치 확인 창의 "예", 프로그램 실행, 회원가입 같은 것)이 생기면:
  1. 그 일의 안내 문서(`docs/guides/*.html`)를 **브라우저로 연다** — Windows: `start "" "<파일>"`(Git Bash) 또는
     `Start-Process "<파일>"`(PowerShell) / macOS: `open "<파일>"` / Linux: `xdg-open "<파일>"`
  2. "열린 안내대로 ○○를 해 주세요. 끝나면 '했어' 라고 말해 주세요" 한 줄로 말하고 기다린다
  3. "했어" 가 오면 **다시 확인**하고 다음으로 간다 (확인이 안 되면 무엇이 안 됐는지 말한다)
- 끊겨도 괜찮다 — 다시 `/start` 하면 아래 0 에서 어디까지 했는지 보고 이어서 한다. 프로그램을 설치하면 **VS Code 를
  완전히 껐다 켜야** 새 프로그램이 보인다(Windows) — 그럴 땐 그렇게 말하고 멈춘다

## 0. 어디까지 했나

| 보이는 것 | 뜻 | 할 일 |
| --- | --- | --- |
| `PROJECT.md` 가 있다 | 기획까지 끝난 프로젝트 | 멈추고 안내: 개발은 `/autopilot`(맡기고 자기) 또는 `/fullstack` 등 (하나씩) |
| `PRD/00_brief.md` 머리에 `> /start 인터뷰` | 아이디어 · 이름은 정했다 | 표시명 · slug 를 거기서 읽고 4 부터 |
| 둘 다 없다 | 처음 | 1 부터 |

4~6 의 각 항목도 이미 된 것(`.env` 에 값이 있음, DB 가 있음, 관리자가 있음 …)은 건너뛴다.

## 1. 인사 · 아이디어 — 대화로

짧게 알린다: "만들 것을 같이 정하고 → 이 PC 에서 돌아가게 준비하고 → 기획까지 갈게요. 사람이 할 일은 처음 대화와
가끔 설치 확인 정도예요. (준비 20~40분, 기획 30~60분)"

`$ARGUMENTS` 에 아이디어가 있으면 거기서 시작한다. 양식이 아니라 **대화**다 — 한 번에 한두 가지만 묻고, 들은 걸 사용자의 말로
되받아 정리한다. "모르겠다"는 그대로 받는다 (추측으로 채우지 않는다). 알아낼 것은 `/plan` 인터뷰와 같다:

- 무엇을 · 누가 쓰나(얼마나) · 지금은 그 문제를 어떻게 해결하나(진짜 경쟁자는 엑셀 · 전화 · 카톡인 경우가 많다)
- 돈은 어떻게 버나 (구독 · 수수료 · 광고 · 내부용) — 결제가 있으면 PG 심사가 일정을 좌우한다
- 언제까지 · 몇 명이서
- 로그인 방식(구글 · 카카오 · 이메일) · 관리자 화면이 필요한가
- 개인정보 · 결제 · 위치 · 의료 · 금융 · 청소년 중 해당하는 것 · 참고하는 서비스

세 번쯤 주고받고 한 문단으로 요약해 "이렇게 이해했어요 — 맞아요?" 를 묻는다. "그냥 알아서 해" 면 아는 것만으로 간다.

## 2. 이름

- **표시명**(화면 · 제목에 쓴다, 한글 가능)과 **slug**(영문 소문자 · 숫자 · `_`, DB · 서버 이름에 쓴다)를 아이디어에서 제안하고 확인받는다
- 예: 표시명 "동네 클래스", slug `dongne_class` → DB `db_dongne_class` · `db_dongne_class_test` · `db_dongne_class_e2e`

## 3. 브리프 — `PRD/00_brief.md`

`/plan` 2단계 양식 그대로 쓰되 머리 줄을 이렇게 — `/plan` 이 이걸 보고 인터뷰를 건너뛰고, 다시 `/start` 하면 여기서 이름을 읽는다:

```markdown
# 브리프: [표시명]
> /start 인터뷰 · 작성일: YYYY-MM-DD · 표시명: [표시명] · slug: [slug] · 한 줄 소개: [한 줄]
```

## 4. 도구 — 없으면 설치를 돕는다

| 도구 | 확인 | 왜 | 없으면 (Windows) | 없으면 (macOS · Linux) |
| --- | --- | --- | --- | --- |
| Git | `git --version` | 기록 · GitHub | `winget install --id Git.Git -e` | macOS 는 처음 `git` 을 치면 설치 창 |
| uv | `uv --version` | **파이썬을 대신 받아 온다** — 파이썬을 따로 설치하지 않는다 | `winget install --id astral-sh.uv -e` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js 20 이상 | `node --version` | 화면(프론트) | `winget install --id OpenJS.NodeJS.LTS -e` | nodejs.org 의 LTS 설치 파일 |

- 설치는 **사용자에게 먼저 묻고**("제가 설치할게요 — 관리자 확인 창이 뜨면 '예' 를 눌러 주세요") 한다.
  `winget` 이 없거나 실패하면 `docs/guides/02-tools.html` 을 열어 손으로 설치하게 한다
- 설치가 끝나면 Windows 는 지금 창에서 바로 안 보일 수 있다 → "VS Code 를 완전히 껐다 켜고 `/start` 를 다시 쳐 주세요" 로 멈춘다

## 5. 이 PC 에서 돌아가게 — 묻지 않고 한다

`/setup` ①~④ 중 이 PC 에 필요한 것이다. **로컬 값이라 되돌리기 쉬워서 기본값으로 정한다** (`/setup` 은 하나씩 묻는다 —
처음 쓰는 사람에게는 이게 맞다). 운영 값(`prod_*` · 도메인 · `infra/`)은 건드리지 않는다.

1. **설정 파일** — `backend/.env` · `frontend/.env` 가 없으면 `.env.example` 에서 복사. `backend/.env` 에서:
   - `jwt_secret` · `hash_key` 가 비었으면 새로 만든다 — `cd backend && uv run python -c "import secrets; print(secrets.token_urlsafe(48))"`
   - `local_mysql_db` · `test_mysql_db` 가 템플릿 기본값(`db_example` · `db_base_test`)이면 `db_{slug}` · `db_{slug}_test`
   - 이미 사람이 바꾼 값은 덮어쓰지 않는다
2. **템플릿 이름 바꾸기** — `frontend/e2e/env.ts` 의 `db_base_e2e` → `db_{slug}_e2e`, `docker/mysql/init.sql` 의 DB 이름 3개,
   `docker-compose.yml` 의 `container_name`(`base-mysql` · `base-redis` → `{slug}-mysql` · `{slug}-redis`)과 `MYSQL_DATABASE`
3. **파이썬 · 패키지** — `cd backend && uv sync` (파이썬이 없으면 uv 가 받아 온다. 처음엔 몇 분)
4. **DB · Redis** — `cd backend && uv run python -m scripts.prepare_local check`
   - **둘 다 OK** (이미 이 PC 에 떠 있다 — 다른 프로젝트와 같이 써도 된다):
     `… prepare_local databases db_{slug} db_{slug}_test db_{slug}_e2e`, `… prepare_local redis-db` 가 준 번호를 `.env` 의 `redis_db` 에
   - **Redis 인증 실패** — "no password is set" 이면 `.env` 의 `local_redis_password` 를 비운다. 비밀번호가 틀렸다면 사용자에게 묻는다
     (이것만 묻는다). 고친 뒤 다시 check
   - **접속 안 됨** — Docker 로 띄운다:
     - `docker info` 가 되면 저장소 루트에서 `docker compose up -d` → `docker compose ps` 가 healthy 가 될 때까지 기다린 뒤 다시 check →
       `databases` · `redis-db` (위와 같이)
     - Docker 가 설치돼 있는데 꺼져 있으면: Docker Desktop 을 켜 달라고 한다 (`docs/guides/03-docker.html`)
     - Docker 가 없으면: 설치를 묻는다 — Windows `winget install --id Docker.DockerDesktop -e` (**재부팅이 필요할 수 있다**),
       안내는 `docs/guides/03-docker.html`. Docker 를 못 쓰는 PC 면 `docs/guides/04-mysql-redis.html`(직접 설치)
5. **테이블** — `cd backend && uv run alembic upgrade head`
6. **로컬 관리자** — 비밀번호를 만들어(위 secrets 명령, 16자) 환경변수로 넘긴다:
   `ADMIN_PASSWORD=<만든 값> uv run python -m scripts.create_admin admin@example.com --password-env ADMIN_PASSWORD`.
   이메일 · 비밀번호는 마지막 보고에 **한 번** 보여 준다 (파일에 적지 않는다)
7. **화면 쪽** — `cd frontend && npm install`, 이어서 `npx playwright install chromium`(자동 확인용 브라우저, 처음 한 번 · 수백 MB)
8. **이름 입히기** — `frontend/index.html` 의 `BASE`(제목 · og:title · og:site_name · JSON-LD name) → 표시명,
   "프로젝트 한 줄 소개" 두 곳 → 한 줄 소개. `example.com`(도메인)은 그대로 — 운영 도메인을 정할 때 `/setup` ②
9. **돌아가는지 확인** — 아래가 전부 통과하면 "로그인 · 세션 · 관리자 화면까지 브라우저로 확인됐다" 는 뜻이다
   ```bash
   cd backend  && uv run pytest -q
   cd frontend && npm run check:types && npm test && npm run e2e
   ```
   실패하면 설정 문제(DB 이름 · Redis 번호 · 3100/8100 포트를 다른 프로그램이 씀 등)를 찾아 고치고 다시. 두 번 실패하면 멈추고
   무엇이 실패했는지 쉬운 말로 보고한다 (코드를 고치지 않는다 — 템플릿 그대로는 통과해야 정상이다)

## 6. git — 이 프로젝트의 기록으로 새로 시작

| 지금 | 할 일 |
| --- | --- |
| git 저장소가 아니다 (ZIP 으로 받음) | `git init -b main` → 아래 첫 커밋 |
| 커밋이 하나뿐 (GitHub "Use this template" 으로 만든 내 저장소) | 원격은 이미 내 저장소다. 지금 변경만 커밋 |
| 커밋이 여럿 (base 를 그대로 clone) | base 기록 · 원격을 떼고 새로 시작 ↓ |

```bash
git remote remove origin              # base 를 가리키고 있다 — 여기로 푸시하면 안 된다
git checkout --orphan start
git add -A
git commit -m "init: {표시명} — base 템플릿에서 시작"
git branch -M start main
```

`rm -rf .git` 은 쓰지 않는다 (위 방법이면 지울 것 없이 새 기록이 된다). `.env` 는 `.gitignore` 라 커밋되지 않는다 — 커밋 전에 `git status` 로 확인.
내 GitHub 에 올리고 싶으면 `docs/guides/05-github.html` (저장소 만들기 → `git remote add origin …` → `git push -u origin main`).

## 7. 보고 → 기획으로

| 항목 | 결과 |
| --- | --- |
| 이름 | 표시명 · slug |
| DB · Redis | `db_{slug}` · `_test` · `_e2e` / Redis 번호 / 이미 있던 걸 썼는지, Docker 로 띄웠는지 |
| 관리자 | `admin@example.com` / 만든 비밀번호 — 화면: `cd frontend && npm run dev` 와 `cd backend && sh run.sh` 뒤 http://localhost:3000/admin |
| 확인 | pytest · 화면 테스트 · E2E 통과 여부 |
| git | 새 기록 · 원격 |

그리고 묻는다: **"기획(`/plan`)을 바로 시작할까요? 리서치 → 기획서 → 화면 목록 → 디자인 → 개발 계획까지 30~60분, 그동안 자리를 비워도 돼요."**
예면 `/plan` 을 이어서 한다 (브리프가 있어 인터뷰를 건너뛴다). 아니면 "나중에 `/plan` 이라고 치면 돼요".

## 하지 말 것

- 운영 값(`prod_*` · 도메인 · `infra/`)을 건드리지 않는다
- 이미 채워진 `.env` 값을 덮어쓰지 않는다 (빈 칸과 템플릿 기본값만)
- 다른 프로젝트의 DB · Redis 를 건드리지 않는다 — `CREATE DATABASE IF NOT EXISTS` 와 비어 있는 Redis 번호만 (`prepare_local` 이 그렇게 한다)
- 사용자에게 묻지 않고 프로그램을 설치하지 않는다
- 셋업 확인이 실패했다고 앱 코드를 고치지 않는다 — 설정을 본다
