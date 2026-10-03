---
name: start
description: "처음 한 번 — 이 템플릿을 막 받은 사람(개발 도구가 하나도 없어도 된다)이 만들 것을 대화로 정하고, 이 PC 에서 돌아가게 셋업(도구 · DB · 시크릿 · 이름 · git)한 뒤 /plan 으로 넘어간다. 여러 번 다시 쳐도 했던 단계는 건너뛴다. 이미 PROJECT.md 가 있으면 쓰지 않는다."
---

$ARGUMENTS

이 저장소를 막 받은 사람이 `/start` 하나로 **"만들 것 정하기 → 이 PC 에서 돌아가게 → 기획"** 까지 간다.
쓰는 사람은 **개발자가 아닐 수 있다** — 파이썬도 Node 도 없고, 터미널이 뭔지 모를 수 있다고 가정한다.

## 말하는 방식

- 쉬운 말로. 명령어 · 파일 경로는 필요할 때만 보여 주고, 무엇을 하는지 한 줄로 먼저 말한다 ("DB 를 만들게요")
- **사람의 답이 필요한 곳은 전부 AskUserQuestion(선택지)으로 묻는다** — 글로 묻고 기다리지 않는다.
  Remote Control 로 휴대폰에서 볼 때 선택지 창이어야 **알림이 간다**. 비개발자에게도 버튼이 쉽다.
  자유롭게 말할 것(아이디어 · 비밀번호 · 이름)도 선택지 + 직접 입력(Other)으로 받는다. 한 번에 4개까지 묶을 수 있다
- **사람이 직접 해야 하는 일**(설치 확인 창의 "예", 프로그램 실행 · 약관 동의 같은 것)이 생기면:
  1. 그 일의 안내 문서(`docs/guides/*.html`)를 **브라우저로 연다** — Windows: `start "" "<파일>"`(Git Bash) 또는
     `Start-Process "<파일>"`(PowerShell) / macOS: `open "<파일>"` / Linux: `xdg-open "<파일>"`
  2. AskUserQuestion 으로 기다린다 — "열린 안내대로 ○○를 해 주세요" + 선택지 [다 했어요 / 막혔어요]
  3. "다 했어요" 면 **다시 확인**하고 다음으로 간다. 확인이 안 되거나 "막혔어요" 면 무엇이 안 됐는지 보고 다시 묻는다
- 숫자 범위는 `~` 로 쓰지 않는다 (화면에서 `20~40분, 30~60분` 의 `~` 두 개가 취소선이 된다) — "30분 안팎", "20–40분"
- **할 수 있는 건 묻지 않고 한다.** 있으면 건너뛰고, 없으면 설치한다 — 사람에게 넘기는 건 Claude 가 할 수 없는 것뿐이다
  (Windows 설치 확인 창의 "예" · 프로그램 첫 실행의 약관 동의 · 재부팅 · 사람만 아는 비밀번호). 설치 확인 창은 보안 장치다 — 우회하지 않는다
- **명령은 저장소 루트에서, `cd` 를 섞지 않는다.** `cd … && …` 처럼 폴더를 옮기는 묶음 명령은 허용 설정이 있어도 확인 창이 뜬다 —
  처음 쓰는 사람이 "허용" 을 계속 누르게 된다. 세션은 이미 저장소 루트에 있다. 하위 폴더는 `uv --directory backend …` ·
  `npm --prefix frontend …` 로, 명령 하나에 한 가지 일만 (아래 명령들이 모두 그 형태다)
- 끊겨도 괜찮다 — 다시 `/start` 하면 아래 0 에서 어디까지 했는지 보고 이어서 한다 (재부팅이 필요할 때가 그렇다)

## 0. 어디까지 했나 · git 바로 끊기

| 보이는 것 | 뜻 | 할 일 |
| --- | --- | --- |
| `PROJECT.md` 가 있다 | 기획까지 끝난 프로젝트 | 멈추고 안내: 개발은 `/autopilot`(맡기고 자기) 또는 `/fullstack` 등 (하나씩) |
| `PRD/00_brief.md` 머리에 `> /start 인터뷰` | 아이디어 · 이름은 정했다 | 표시명 · slug 를 거기서 읽고 4 부터 |
| `backend/.env` 가 없다 | **막 받은 템플릿 — 새 프로젝트다** | 묻지 않고 아래 "git 바로 끊기" → 1 부터 |
| `backend/.env` 가 있고 커밋이 여럿 · 브리프 없음 | 셋업해 둔 템플릿 원본일 수 있다 | AskUserQuestion: "여기를 새 프로젝트로 바꿀까요? (설정 · 이름 · git 기록이 바뀌어요)" [새 프로젝트로 / 아니요 — 멈추기] |

**git 바로 끊기** — 새 프로젝트로 정해지면 아이디어보다 먼저 한다 (base 를 가리키는 원격으로 실수로 푸시하지 않게):

| 지금 | 할 일 |
| --- | --- |
| git 저장소가 아니다 (ZIP 으로 받음) | `git init -b main` → 첫 커밋 |
| 커밋이 하나뿐 (GitHub "Use this template" 으로 만든 내 저장소) | 그대로 — 원격은 이미 내 저장소다 |
| 커밋이 여럿 (base 를 그대로 받음) | base 원격과 기록을 떼고 새로 시작 ↓ |

```bash
git remote remove origin
git checkout --orphan start
git add -A
git commit -m "init: base 템플릿에서 시작"
git branch -M start main
```

- `rm -rf .git` 은 쓰지 않는다 (위 방법이면 지울 것 없이 새 기록이 된다)
- 커밋 전에 `git config user.name` · `git config user.email` 이 비어 있으면(처음 쓰는 PC) 이 폴더에만 임시로 정한다 —
  `git config user.name "me"` · `git config user.email "me@localhost"`. GitHub 에 올릴 때(05) 본인 것으로 바꾸자고 마지막 보고에서 말한다

4~6 의 각 항목도 이미 된 것(`.env` 에 값이 있음, DB 가 있음, 관리자가 있음 …)은 건너뛴다.

## 1. 인사 · 아이디어

짧게 알린다: "만들 것을 같이 정하고 → 이 PC 에서 돌아가게 준비하고 → 기획까지 갈게요. 필요한 프로그램이 없으면 제가 설치해요 —
Windows 확인 창이 뜨면 '예' 만 눌러 주세요. (준비 30분 안팎, 기획 1시간 안팎)"

첫 메시지에 아이디어나 자료가 이미 있으면 바로 그걸로 간다. 없으면 AskUserQuestion — "무엇을 만들까요?"
[한두 줄로 말할게요 · 고객과 나눈 대화를 붙여넣을게요 · 계약서 같은 파일이 있어요] + 직접 입력(여기에 바로 아이디어를 써도 된다)

**받는 것은 한 줄 아이디어만이 아니다** — 고객과 나눈 대화(카톡 · 메일 · 회의록), 계약서 · 과업지시서 · 견적서, 기획 메모일 수 있다.

| 들어온 것 | 할 일 |
| --- | --- |
| 한두 줄 (직접 입력) | 그걸로 아래 질문을 이어 간다 |
| "붙여넣을게요" | "다음 메시지에 그대로 붙여넣어 주세요" — 받으면 원문을 `PRD/sources/` 에 `대화-YYYYMMDD.md` 로 그대로 저장하고 읽는다 |
| "파일이 있어요" | `PRD/sources/` 를 만들고 **탐색기로 열어 준다**(Windows `explorer "PRD\sources"` / macOS `open PRD/sources`) → AskUserQuestion [다 넣었어요 / 파일이 없어요] |

`PRD/sources/` 의 파일 읽기:
- txt · md · csv(카카오톡 대화 내보내기 포함) · docx · hwpx · xlsx · pptx —
  `uv run --no-project python backend/scripts/extract_text.py PRD/sources/*` (uv 만 있으면 된다 — 없으면 4단계의 uv 설치를 먼저 한다)
- pdf · 캡처 이미지 — Read 로 직접 (PDF 가 10쪽이 넘으면 pages 로 나눠서)
- hwp · doc · xls(옛 형식) — "한글(오피스)에서 다른 이름으로 저장 → hwpx(docx) 나 PDF 로 저장해 주세요"

**자료가 있으면 질문은 빈 칸만** — 자료에 이미 답이 있는 건 묻지 않는다. 대신 이렇게 정리해서 확인받는다:
- 자료에서 읽은 것 (아래 "알아낼 것" 기준)
- **자료끼리 어긋나는 것** — 예: 대화에서는 "카카오 로그인" 인데 과업지시서에는 "휴대폰 인증" → 어느 쪽인지 묻는다
- **계약 조건** — 범위(과업 목록) · 납기 · 대금과 지급 단계 · 검수 기준 · 하자보수 기간 · 지식재산권 · 비밀유지. 브리프의 "고정 조건" 이 된다
- 자료에 없는 것 중 꼭 필요한 것만 질문

`PRD/sources/` 는 `.gitignore` 에 있다 — 고객 대화 · 계약서에는 개인정보와 기밀이 있어 git(GitHub)에 올리지 않는다.
브리프에는 요약만 쓰고, 사람 이름 · 연락처 · 계좌 같은 건 옮기지 않는다 (필요하면 "담당자 A" 처럼).

질문은 **AskUserQuestion 으로 묶어서** 묻는다 (한 번에 4개까지, 질문마다 흔한 답 2–4개 + 직접 입력).
들은 걸 사용자의 말로 되받아 정리한다. "모르겠다"는 그대로 받는다 (추측으로 채우지 않는다) — 선택지에 "아직 모르겠어요" 를 넣는다.
알아낼 것은 `/plan` 인터뷰와 같다 (자료에 답이 있는 건 뺀다):

- 무엇을 · 누가 쓰나(얼마나) · 지금은 그 문제를 어떻게 해결하나(진짜 경쟁자는 엑셀 · 전화 · 카톡인 경우가 많다)
- 돈은 어떻게 버나 (구독 · 수수료 · 광고 · 내부용) — 결제가 있으면 PG 심사가 일정을 좌우한다
- 언제까지 · 몇 명이서
- 로그인 방식(구글 · 카카오 · 이메일 — 여러 개 고를 수 있게) · 관리자 화면이 필요한가
- 개인정보 · 결제 · 위치 · 의료 · 금융 · 청소년 중 해당하는 것 · 참고하는 서비스

두세 번 묻고 한 문단으로 요약한 뒤 AskUserQuestion — "이렇게 이해했어요" [맞아요 / 고칠 게 있어요(직접 입력)].
"그냥 알아서 해" 면 아는 것만으로 간다.

## 2. 이름

- **표시명**(화면 · 제목에 쓴다, 한글 가능)과 **slug**(영문 소문자 · 숫자 · `_`, DB · 서버 이름에 쓴다)를 아이디어에서 2–3개 제안해
  AskUserQuestion 으로 고르게 한다 (선택지 이름 예: "동네 클래스 · dongne_class") + 직접 입력
- 예: 표시명 "동네 클래스", slug `dongne_class` → DB `db_dongne_class` · `db_dongne_class_test` · `db_dongne_class_e2e`

## 3. 브리프 — `PRD/00_brief.md`

`/plan` 2단계 양식 그대로 쓰되 머리 줄을 이렇게 — `/plan` 이 이걸 보고 인터뷰를 건너뛰고, 다시 `/start` 하면 여기서 이름을 읽는다:

```markdown
# 브리프: [표시명]
> /start 인터뷰 · 작성일: YYYY-MM-DD · 표시명: [표시명] · slug: [slug] · 한 줄 소개: [한 줄]

## 자료 (있을 때)
- PRD/sources/계약서.pdf — 표준 용역 계약 (2026-09-30 체결) · 원본은 git 에 없음
- PRD/sources/대화-20260928.md — 고객 카톡 대화 요약

## 고정 조건 (계약 · 자료에서 — 있을 때)
| 항목 | 내용 | 출처 |
| --- | --- | --- |
| 범위 | 과업 1~7 (아래) | 과업지시서 3장 |
| 납기 | 2026-12-15 | 계약서 제4조 |
| 대금 | 3회 분할 — 착수 30 · 중도 40 · 잔금 30 | 계약서 제6조 |
| 검수 · 하자보수 | 검수 10일 · 하자보수 6개월 | 계약서 제9 · 11조 |
```
`/plan` 의 PRD 는 고정 조건을 넘지 않는다 — 계약 범위 밖의 기능은 must 가 아니라 "범위 결정 필요"로 `DECISIONS.md` 에 간다.

## 4. 도구 — 있으면 건너뛰고, 없으면 설치한다

| 도구 | 확인 | 왜 | 없으면 (Windows — 묻지 않고) | 없으면 (macOS · Linux) |
| --- | --- | --- | --- | --- |
| uv | `uv --version` | **파이썬을 대신 받아 온다** — 파이썬은 설치하지 않는다 | `winget install --id astral-sh.uv -e` (확인 창 없음) | `brew install uv`, brew 가 없으면 `02-tools.html` |
| Node.js 20+ | `node --version` | 화면(프론트) | `winget install --id OpenJS.NodeJS.LTS -e` ("예" 한 번) | `brew install node`, 없으면 `02-tools.html` |
| Git | `git --version` | 기록 · GitHub | `winget install --id Git.Git -e` ("예" 한 번) | macOS 는 `git` 을 치면 설치 창이 뜬다 |

- winget 은 **항상** `--accept-package-agreements --accept-source-agreements` 를 붙인다 — 안 붙이면 처음 쓸 때 동의를 묻느라 멈춘다
- 설치를 시작하기 전에 한 줄: "Node.js 를 설치할게요 — 확인 창이 뜨면 '예' 를 눌러 주세요"
- **설치 직후에도 VS Code 를 껐다 켜지 않는다** — 지금 세션은 옛 PATH 를 갖고 있으니 명령마다 새 경로를 앞에 붙여 쓴다.
  확인도 그렇게 한다 (Bash 도구는 명령마다 셸이 새로 떠서, 매번 붙여야 한다):
  ```bash
  # Git Bash (Windows) — 설치된 것만 앞에 붙여도 된다
  export PATH="/c/Program Files/nodejs:/c/Program Files/Git/cmd:$HOME/AppData/Local/Microsoft/WinGet/Links:$HOME/.local/bin:/c/Program Files/Docker/Docker/resources/bin:$PATH"
  ```
  ```powershell
  # PowerShell — 시스템 · 사용자 PATH 를 레지스트리에서 다시 읽는다
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  ```
  그래도 못 찾을 때만 "VS Code 를 껐다 켜고 `/start` 를 다시 쳐 주세요" 로 멈춘다
- winget 이 없거나(오래된 Windows) 설치가 실패하면 그때 `docs/guides/02-tools.html` 을 열어 손으로 하게 한다
- `curl … | sh` 로 설치하지 않는다 (`.claude/settings.json` 이 막아 둔 형태다)

## 5. 이 PC 에서 돌아가게 — 묻지 않고 한다

`/setup` ①~④ 중 이 PC 에 필요한 것이다. **로컬 값이라 되돌리기 쉬워서 기본값으로 정한다** (`/setup` 은 하나씩 묻는다 —
처음 쓰는 사람에게는 이게 맞다). 운영 값(`prod_*` · 도메인 · `infra/`)은 건드리지 않는다.

1. **설정 파일** — `backend/.env` · `frontend/.env` 가 없으면 `.env.example` 에서 복사. `backend/.env` 에서:
   - `jwt_secret` · `hash_key` 가 비었으면 새로 만든다 — `uv run --no-project python -c "import secrets; print(secrets.token_urlsafe(48))"`
   - `local_mysql_db` · `test_mysql_db` 가 템플릿 기본값(`db_example` · `db_base_test`)이면 `db_{slug}` · `db_{slug}_test`
   - 이미 사람이 바꾼 값은 덮어쓰지 않는다
2. **템플릿 이름 바꾸기** — `frontend/e2e/env.ts` 의 `db_base_e2e` → `db_{slug}_e2e`, `docker/mysql/init.sql` 의 DB 이름 3개,
   `docker-compose.yml` 의 `container_name`(`base-mysql` · `base-redis` → `{slug}-mysql` · `{slug}-redis`)과 `MYSQL_DATABASE`
3. **파이썬 · 패키지** — `uv --directory backend sync` (파이썬이 없으면 uv 가 받아 온다. 처음엔 몇 분)
4. **DB · Redis** — `uv --directory backend run python -m scripts.prepare_local check`
   - **둘 다 OK** (이미 이 PC 에 떠 있다 — 다른 프로젝트와 같이 써도 된다):
     `… prepare_local databases db_{slug} db_{slug}_test db_{slug}_e2e`, `… prepare_local redis-db` 가 준 번호를 `.env` 의 `redis_db` 에
   - **Redis 인증 실패** — "no password is set" 이면 `.env` 의 `local_redis_password` 를 비운다. 비밀번호가 틀렸다면 AskUserQuestion 으로 묻는다
     [비밀번호를 알아요(직접 입력) / 모르겠어요 → Docker 로 새로 띄우기]. 고친 뒤 다시 check
   - **접속 안 됨** — Docker 로 띄운다. 할 수 있는 건 다 알아서:
     1. `docker` 가 없으면 설치 — Windows `winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements`
        ("예" 한 번). WSL 이 없다고 나오면 `wsl --install --no-distribution`(PowerShell, "예" 한 번). 둘 다 **재부팅이 필요할 수 있다** —
        그러면 "PC 를 다시 시작하고 VS Code 를 열어 `/start` 를 쳐 주세요" 로 멈춘다. macOS 는 `brew install --cask docker`, 없으면 `03-docker.html`
     2. 꺼져 있으면(`docker info` 실패) 켠다 — Windows `Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"`, macOS `open -a Docker`.
        `docker info` 가 될 때까지 10초 간격으로 2분 기다린다
     3. 2분이 지나도 안 켜지면 대개 첫 실행의 약관 화면이다 → `docs/guides/03-docker.html` 을 열고 AskUserQuestion "Docker Desktop 의 약관에 동의(Accept)해 주세요" [다 했어요 / 막혔어요] 로 기다린다.
        가상화가 꺼져 있다는 메시지면 같은 문서의 "막히면" (BIOS) — 그래도 안 되면 `04-mysql-redis.html`(직접 설치)
     4. 켜지면 저장소 루트에서 `docker compose up -d` → `docker compose ps` 가 둘 다 healthy 가 될 때까지 기다림 → 다시 `check` →
        `databases` · `redis-db` (위와 같이)
5. **테이블** — `uv --directory backend run alembic upgrade head`
6. **로컬 관리자** — 비밀번호를 만들어(위 secrets 명령, 16자) 환경변수로 넘긴다:
   `ADMIN_PASSWORD=<만든 값> uv --directory backend run python -m scripts.create_admin admin@example.com --password-env ADMIN_PASSWORD`.
   이메일 · 비밀번호는 마지막 보고에 **한 번** 보여 준다 (파일에 적지 않는다)
7. **화면 쪽** — `npm --prefix frontend install`, 이어서 `npm --prefix frontend exec -- playwright install chromium`(자동 확인용 브라우저, 처음 한 번 · 수백 MB)
8. **이름 입히기** — `frontend/index.html` 의 `BASE`(제목 · og:title · og:site_name · JSON-LD name) → 표시명,
   "프로젝트 한 줄 소개" 두 곳 → 한 줄 소개. `example.com`(도메인)은 그대로 — 운영 도메인을 정할 때 `/setup` ②
9. **돌아가는지 확인** — 아래가 전부 통과하면 "로그인 · 세션 · 관리자 화면까지 브라우저로 확인됐다" 는 뜻이다
   ```bash
   uv --directory backend run pytest -q
   npm --prefix frontend run check:types
   npm --prefix frontend test
   npm --prefix frontend run e2e
   ```
   E2E 는 3100 · 8100 포트를 쓴다 — 다른 프로그램이 쓰고 있으면 빈 포트를 골라 `E2E_WEB_PORT=… E2E_API_PORT=… npm --prefix frontend run e2e`.
   실패하면 설정 문제(DB 이름 · Redis 번호 등)를 찾아 고치고 다시. 두 번 실패하면 멈추고
   무엇이 실패했는지 쉬운 말로 보고한다 (코드를 고치지 않는다 — 템플릿 그대로는 통과해야 정상이다)

## 6. 셋업 결과 커밋

git 은 0 에서 이미 새 기록으로 시작했다. 여기서는 브리프 · 이름 바꾸기 · 설정 파일 변경을 커밋만 한다 —
`git status` 로 `.env` · `PRD/sources/` 가 안 들어가는지 보고 `git commit -m "chore: {표시명} — /start 셋업"`.
내 GitHub 에 올리고 싶으면 `docs/guides/05-github.html` (저장소 만들기 → `git remote add origin …` → `git push -u origin main`).

## 7. 보고 → 기획으로

| 항목 | 결과 |
| --- | --- |
| 이름 | 표시명 · slug |
| DB · Redis | `db_{slug}` · `_test` · `_e2e` / Redis 번호 / 이미 있던 걸 썼는지, Docker 로 띄웠는지 |
| 관리자 | `admin@example.com` / 만든 비밀번호 — 화면: `cd frontend && npm run dev` 와 `cd backend && sh run.sh` 뒤 http://localhost:3000/admin |
| 확인 | pytest · 화면 테스트 · E2E 통과 여부 |
| git | 새 기록 · 원격 |

그리고 AskUserQuestion: **"기획을 바로 시작할까요? 리서치 → 기획서 → 화면 목록 → 디자인 → 개발 계획까지 1시간 안팎, 그동안 자리를 비워도 돼요."**
[지금 시작 (추천) / 나중에]. 지금이면 `/plan` 을 이어서 한다 (브리프가 있어 인터뷰를 건너뛴다). 나중이면 "나중에 `/plan` 이라고 치면 돼요".
git 사용자 이름을 임시(`me`)로 정했다면 여기서 한 줄 알린다.

## 하지 말 것

- 운영 값(`prod_*` · 도메인 · `infra/`)을 건드리지 않는다
- 이미 채워진 `.env` 값을 덮어쓰지 않는다 (빈 칸과 템플릿 기본값만)
- 다른 프로젝트의 DB · Redis 를 건드리지 않는다 — `CREATE DATABASE IF NOT EXISTS` 와 비어 있는 Redis 번호만 (`prepare_local` 이 그렇게 한다)
- 설치 확인 창(UAC) · `sudo` 비밀번호를 우회하지 않는다 — 사람이 누르게 한다
- 셋업 확인이 실패했다고 앱 코드를 고치지 않는다 — 설정을 본다
