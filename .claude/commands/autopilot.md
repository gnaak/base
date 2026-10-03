---
name: autopilot
description: "PROJECT.md 의 phase 를 사람 없이 끝까지 돈다 — phase 마다 구현 → E2E → 테스트 → /verify → 커밋, 막히면 ❌ 로 적고 다음 phase, 끝나면 DECISIONS.md 요약 + 휴대폰 페이지. /plan 이 끝나면 자동으로 이어진다 (손으로도 부를 수 있다). 인자: 없음(시작·이어서) · status · stop."
allowed-tools: Bash PowerShell Skill WebSearch WebFetch Read Write Edit Glob Grep
---

$ARGUMENTS

`PROJECT.md` 의 phase 1 부터 마지막까지 **사람을 기다리지 않고** 개발한다. 사람은 아침에 `DECISIONS.md`(또는 휴대폰 페이지)를 본다.

멈추지 않게 붙잡는 건 Stop 훅(`.claude/hooks/autopilot-gate.mjs`)이다. 턴을 끝내려 하면 게이트가 `PROGRESS.md` · git 을 보고
남은 phase 가 있으면 멈추지 못하게 하고 다음 지시를 준다. 게이트는 **표시가 아니라 근거로** 판정한다 —
✅ 라고 적어도 그 phase 의 커밋(제목에 `phase N`)과 `- 검증:` 줄이 없으면 넘어가지 않는다.
무한 루프는 상한으로 막는다: 진전 없이 3번 연속 멈춤 · phase 당 40턴 · 마무리 10턴 · 전체 400턴. phase 상한에 걸리면
게이트가 그 phase 를 ❌ 로 적고 다음 phase 를 지시한다.

## 0. 인자

| 인자 | 할 일 |
| --- | --- |
| `stop` | `node .claude/hooks/autopilot-gate.mjs off` → 결과를 보고하고 끝 |
| `status` | `node .claude/hooks/autopilot-gate.mjs status` → 그대로 보여주고 끝 |
| (없음) | 아래 1 부터. 이미 켜져 있으면 같은 run 을 이어서 한다 |

## 1. 시작 전 — 사람이 있을 때 한 번 보는 것

이것들이 안 맞으면 밤새 한 칸도 못 가고 멈춰 있다. 사람이 이 커맨드를 불렀다면 짧게 확인시키고 시작한다.
`/plan` 이 이어서 불렀으면(사람이 없다) 묻지 않는다 — 아래를 스스로 확인하고, 안 되는 것은 `DECISIONS.md` ⛔ 에 적은 뒤 할 수 있는 만큼 간다.

- **권한 창이 뜨면 거기서 멈춘다.** 편집 자동 승인(`acceptEdits` — Shift+Tab 또는 VS Code 의 모드 선택)과
  `Bash`·`PowerShell`·`Skill` 허용(`.claude/settings.json` — 폴더를 신뢰해야 적용된다)이 있어야 한다
- **다른 Stop 훅과 같이 켜지 않는다** — Claude Code 기본 `/goal`, `ralph-loop`, `security-guidance` 같은 플러그인.
  Stop 훅이 둘이면 서로 다른 지시가 섞인다
- **외부 mod·플러그인은 끈다** — mod 는 PreToolUse 훅이 막은 명령도 승인할 수 있어서 아래 "넘지 않는 선"이 무력해진다
- `node` 가 PATH 에 있어야 한다 (게이트가 Node 스크립트다)
- 로컬 MySQL·Redis 가 떠 있고 `backend/.env` 가 맞다 (`/setup` ②). E2E 를 돌리려면 `db_base_e2e`(프로젝트 이름) DB

## 2. 시작

1. `PROJECT.md` 가 없으면 멈추고 `/plan` 을 먼저 하라고 보고한다
2. **브랜치** — `main`·`master` 면 `git switch -c auto/{YYYYMMDD-HHMM}`. 무인 실행은 브랜치에서만 한다
3. **작업 트리를 깨끗하게** — `/plan` 산출물(`PRD/` · `PROJECT.md` · `PROGRESS.md` · `DECISIONS.md`)이 커밋 안 됐으면
   `docs: 기획 — /plan 산출물` 로 커밋한다. 그 밖의 변경이 있으면 멈추고 보고한다 (남의 작업일 수 있다)
4. **기준선** — 루트 `CLAUDE.md` 의 검증 명령을 한 번 돌린다. 이미 깨진 것이 있으면 `DECISIONS.md` ⛔ 에
   "시작 전부터 깨져 있음" 으로 적는다 — 나중에 phase 가 깬 것과 구분하려고
5. `node .claude/hooks/autopilot-gate.mjs start` — 출력의 **run id** 를 기억한다 (마무리 요약에 쓴다).
   거부되면(브랜치·변경·PROJECT.md) 그 이유를 고치고 다시
6. "이제부터 사람 없이 끝까지 돕니다. 멈추려면 `/autopilot stop`" 이라고 알리고 바로 phase 를 시작한다

## 3. phase 하나

`PROGRESS.md` 에서 ✅·❌ 가 아닌 첫 phase (phase 0 "준비"는 사람이 할 일이라 건너뛴다).

1. `PROGRESS.md` 그 phase 를 `- 상태: 🔄 진행중`
2. **읽기** — `PROJECT.md` 의 그 phase(목표 · 기능 · 페이지 · 설정값 · 모듈 · 완료 기준 · 개발에서 다룰 것),
   `PRD/02_PRD.md` 의 그 F-ID, `PRD/03_PAGE.md` 의 그 P-ID, phase 1 이면 `PRD/04_DESIGN.md`
3. **구현** — 커맨드의 단계를 그대로 따른다 (에이전트 호출 순서 · 보고 확인):
   백엔드 + 화면이면 `/fullstack`, 백엔드만 `/feature`, 화면만 `/design`.
   - **모듈** 줄(`+scheduler` · `−websocket`)이 있으면 **기능보다 먼저** `.claude/skills/modules/references/` 의 그 레시피를
     끝까지 — 빼기는 레시피의 확인 grep 이 0건이어야 끝. 운영 Parameter Store 에서 지울 키는 `DECISIONS.md` 🧑 에.
     **`.claude/` 아래 파일은 고치지 않는다** — 편집 자동 승인에서도 파일마다 확인 창이 떠서 밤새 멈춘다 (modules `SKILL.md` 원칙 6)
   - **하위 에이전트는 `run_in_background: false`** (병렬은 한 메시지에 여러 개). 백그라운드로 맡기고 턴을 끝내면 Stop 훅이
     "진전 없음" 을 세서, 잘 돌고 있는 phase 가 3번 만에 ❌ 로 넘어간다 (시험에서 1/3 까지 올라가는 걸 봤다)
   - **설정값(U\*)** 은 하드코딩하지 않는다 — `RawEnv` 필드 + 기본값 + `backend/.env.example`
   - 모델이 바뀌면 `cd backend && sh migrate.sh "{설명}"` 으로 리비전을 만들고 읽어 본다.
     `DECISIONS.md` 🔍 에 "생성된 마이그레이션: {파일}" 한 줄 (사람이 운영 적용 전에 본다)
   - 외부 업체 키가 없으면 mock 으로 간다 (`be-external-api`) — 키 발급은 🧑 사람이 할 일
4. **phase E2E** — `03_PAGE.md` 에서 이 phase 페이지들의 흐름을 `frontend/e2e/phase-{N}.spec.ts` 로 쓴다.
   - **테스트 이름은 완료 기준 ID 로 시작** — `test("F3-2 남의 주문은 볼 수 없다", …)`. spec-checker 가 ID 로 찾는다
   - 로그인은 `e2e/helpers.ts` 의 `loginNewUser` · `loginAdmin`. 화면이 없는 phase 는 건너뛰고 `PROGRESS.md` 메모에 이유
   - 사람이 화면을 안 보는 대신 E2E 가 화면을 눌러 본다 — "버튼이 실제로 눌리는가"(다른 요소가 가리는가)까지
5. **`/test {도메인}`** — 라우터마다. 테스트 이름이나 docstring 에 완료 기준 ID 를 단다.
   테스트가 **앱 버그**를 잡으면 묻지 말고 앱을 고친다 (최대 3번). 그래도 안 되면 ⛔ 에 적는다.
   테스트를 기대값에 맞춰 느슨하게 고치지 않는다
6. **`/verify phase {N}`** → ❌ 를 고치고 다시 `/verify` (최대 2라운드)
7. **판정**
   - ✅ — 기계 검사(린트·타입·테스트·빌드·E2E)가 초록이고 완료 기준 ❌ 미충족이 없다.
     🟡 테스트 없음 · ⚠️ 는 ✅ 로 가되 `DECISIONS.md` 🔍 에 남긴다
   - ❌ — 2라운드 뒤에도 빨간 기계 검사나 미충족 완료 기준이 남았다. 이때는
     ① `git stash push -u -m "autopilot phase {N}" -- . ":(exclude)PROGRESS.md" ":(exclude)DECISIONS.md"` 로
        이 phase 의 변경을 치운다 (지우지 않는다 — 사람이 본다. 두 파일을 빼는 건 그 기록까지 치워지지 않게)
     ② `PROGRESS.md` 를 `- 상태: ❌ 실패 — {이유 한 줄}` ③ `DECISIONS.md` ⛔ 에 무엇이 막혔고 stash 이름이 무엇인지
     ④ `docs: phase {N} ❌ — {이유}` 로 커밋. 깨진 코드를 커밋해서 다음 phase 가 그 위에 쌓이게 하지 않는다
8. **✅ 기록** — `PROGRESS.md` 의 그 phase:
   ```
   - 상태: ✅ 완료
   - 완료 시각: YYYY-MM-DD HH:MM
   - 수행 내용: (한두 줄)
   - 검증: /verify phase N — 기계 ✅ · 보안 ❌0 ⚠️2 · 완료 기준 충족 5 / 테스트 없음 1 · E2E 3
   ```
9. **커밋** — `feat: phase {N} — {이름}`. **제목에 `phase {N}` 이 있어야 한다** — 게이트가 이걸 근거로 본다
10. 바로 다음 phase 로 간다. 멈출 필요 없다 (멈추면 게이트가 다음 지시를 준다)

## 4. 결정이 필요할 때 — 묻지 않는다

| 경우 | 할 일 |
| --- | --- |
| 되돌리기 쉬운 것 (이름·배치·문구·구현 방식) | 기본값으로 진행. 기록하지 않아도 된다 |
| 돈·법·범위 (`PRD` 의 U\* 포함) | 더 안전한 기본값 + 설정값으로 구현 + `DECISIONS.md` 🔴 |
| 사람이 해야 하는 것 (키 발급·심사·실제 결제 키·배포) | 테스트 키·mock 으로 진행 + `DECISIONS.md` 🧑 |
| must 를 늘려야 하는 발견 | 늘리지 않는다. 🔴 "범위 결정 필요" |
| 코드로 답이 나오는 것 | 코드를 읽고 정한다 — 결정 목록을 늘리지 않는다 |

## 5. 넘지 않는 선

- **push · merge · PR · `main` 전환 · `terraform apply` · 배포 스크립트 · AWS 배포 명령** — PreToolUse 훅이 막는다.
  막히면 우회하지 말고 🧑 에 적는다
- 실제 결제 키 · 운영 `.env` 값을 쓰지 않는다. 테스트 키와 로컬 DB 까지만
- 테스트를 느슨하게 고쳐 통과시키지 않는다. `--no-verify` 로 훅을 건너뛰지 않는다
- 사람이 만든 파일을 지우지 않는다. 치워야 하면 stash

## 6. 마무리 — phase 가 전부 ✅ 또는 ❌

1. 커밋 안 된 변경을 정리한다 (phase 의 것이면 커밋, 아니면 stash)
2. **`/verify full`**
3. `DECISIONS.md` 맨 위(제목 바로 아래)에 이번 run 의 절을 넣고 "마지막 갱신" 줄을 고친다:
   ```markdown
   ## 🌙 무인 실행 결과 — run {run id}
   - 브랜치: auto/… · {시작} → {끝}
   - phase: ✅ 1, 2, 4 · ❌ 3 (이유는 ⛔)
   - 최종 검증: /verify full — 기계 ✅ · 보안 ❌0 ⚠️2 · 완료 기준 충족 18 / 테스트 없음 2 / 미충족 1 · E2E 14
   - 페이지: https://claude.ai/…  (휴대폰)
   - 아침에 할 것: 🔴 2개 결정 — 가장 급한 것 하나를 한 줄로
   ```
4. **휴대폰 페이지** — `DECISIONS.md` 를 비공개 Artifact 로 게시한다 (`artifact-design` 스킬). 🔴 · 🧑 · ⛔ · 🔍 를 접어 볼 수 있게,
   휴대폰 폭에서 읽히게. `DECISIONS.md` 에 이전 run 의 페이지 URL 이 있으면 **같은 URL 을 갱신**한다.
   Artifact 도구가 없으면 `- 페이지: 없음 — {이유}` 로 적는다 (빈칸이면 게이트가 끝내지 않는다)
5. `docs: 무인 실행 결과 — run {run id}` 로 커밋
6. 알림 도구(PushNotification)가 있으면 "무인 실행 끝 — ✅ a · ❌ b · 결정 c개" 한 줄
7. 멈춘다 — 게이트가 요약(이번 run id · 최종 검증 · 페이지 줄)과 깨끗한 작업 트리를 확인하고 autopilot 을 끈다

## 7. 사람이 돌아왔을 때

첫 보고는 `DECISIONS.md` 요약 그대로 — phase 결과, 🔴 결정, ❌ 이유와 stash 이름, 페이지 링크.
push · merge 는 사람이 결과를 확인한 뒤 따로 요청한다.
