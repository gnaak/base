---
name: verify
description: "검증을 한 번에 — 기계 검사(린트·타입·테스트·빌드·디자인 린트) + 보안 검토(sec-reviewer) + 의존성 취약점 + 완료 기준 대조(spec-checker). phase 를 끝낼 때, 푸시 전에, 무인 개발의 각 phase 끝에 사용. 인자: 없음(main 대비 변경분) · full(전체) · phase N · phase N quick(보안 · 의존성 빼고 — 무인 실행의 phase 끝)."
allowed-tools: Bash PowerShell Skill WebSearch WebFetch Read Write Edit Glob Grep
---

$ARGUMENTS

코드를 **고치지 않는다.** 찾아서 보고만 한다. 고치는 건 사용자가 고르거나(사람이 있을 때) 다음 단계가 한다.

## 0. 대상

| 인자 | 대상 |
| --- | --- |
| (없음) | `git diff --name-only main...HEAD` + 아직 커밋 안 된 변경 (`git status --short`) |
| `full` | 저장소 전체 |
| `phase N` | 변경분 + PROJECT.md 의 phase N 완료 기준 대조 |
| `phase N quick` | `phase N` 에서 **보안 검토(2) · 의존성(3)을 뺀다** — 기계 검사 + 완료 기준만. 무인 실행이 phase 마다 쓰고, 보안은 마무리의 `full` 에서 전체 코드로 한 번 본다 |

변경분이 비어 있으면 그렇게 보고하고 끝낸다 (`full` 을 권한다).

## 1. 기계 검사 — 메인이 직접 돌린다

루트 `CLAUDE.md` 의 검증 명령과 같다. 변경분 대상이면 바뀐 쪽만 (backend / frontend / infra).

```bash
cd backend  && uv run ruff check . && uv run pytest -q
cd frontend && npm run check:types && npm run lint && npm test && npm run build
cd frontend && npm run e2e                             # 화면·인증·세션 흐름이 바뀌었거나 full 이면 (브라우저 E2E)
./infra/.bin/<버전>/terraform -chdir=infra test        # infra/ 가 바뀌었으면
```

`npm run e2e` 는 E2E 전용 DB(`db_base_e2e`)가 있어야 돈다 — 없으면 `frontend/CLAUDE.md` "E2E" 의 처음 한 번을 안내하고 이 줄만 건너뛴다.

`npm run lint` 에 **디자인 린트**가 들어 있다 — 고정색(`bg-white`·`gray-*`·`[#hex]`), `tailwind.config.js` 에 없는 클래스,
`-DEFAULT` 클래스. 셋 다 빌드 에러 없이 조용히 틀리는 것이라 무인 개발에서 특히 중요하다.

실패하면 실패한 명령·첫 에러를 그대로 보고에 넣고 다음 단계도 계속한다 (한 번에 다 보이게).

## 2. 보안 검토 — `sec-reviewer` (`quick` 이면 건너뛴다)

대상(변경 파일 목록 또는 `full`)을 넘겨 호출한다. sec-reviewer 는 `.claude/skills/security/` 체크리스트를 따른다.

## 3. 의존성 취약점 — 메인이 직접 돌린다 (네트워크 필요 · `quick` 이면 건너뛴다)

`.claude/skills/security/references/deps.md` 의 명령. `pyproject.toml`·`uv.lock`·`package.json`·`package-lock.json` 이
바뀌었거나 `full` 일 때만. 운영 의존성의 high·critical 은 ❌.

## 4. 완료 기준 대조 — `spec-checker` (PROJECT.md 가 있을 때만)

기계 검사와 겹치지 않으니 **기계 검사를 돌리는 동안 같이** 부른다 (보안 검토가 있으면 sec-reviewer 와 한 메시지에서 병렬 · 포그라운드).
`phase N` 을 받았거나, `PROGRESS.md` 에 🔄 진행중 phase 가 있으면 그 phase 로 호출한다.

## 5. 보고

```
## 검증: [대상] — 통과 / 문제 있음

| 단계 | 결과 |
| --- | --- |
| 기계 검사 | ✅ / ❌ ruff 2건 · pytest 1 실패 … |
| 보안 | ❌ a · ⚠️ b |
| 의존성 | ❌ a (운영 high) · ⚠️ b / 건너뜀 (의존성 안 바뀜) |
| 완료 기준 | 충족 a / 테스트 없음 b / 미충족 c / 해당 없음 |

### ❌ 고쳐야 함 (전 단계 합침, 심각한 순)
- [단계] 파일:줄 — 무엇 — 수정 방안

### ⚠️ 확인 권장
```

**무인 실행 중이면** (`DECISIONS.md` 가 있으면) ❌ 를 `DECISIONS.md` 의 "🔍 검토 필요"에 날짜와 phase 와 함께 덧붙인다.
사람이 있으면 ❌ 중 무엇을 지금 고칠지 묻는다.
