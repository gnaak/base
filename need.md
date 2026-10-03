# need.md — 할 일

✅ 끝 · 🔌 연결만 (실제로 돌려 보기 전) · ⬜ 아직. 끝난 것의 이유는 [`CHANGELOG.md`](CHANGELOG.md), 예전 판의 긴 설명은 `git log -p need.md`.

## 지금

| 무엇 | 상태 | 메모 |
| --- | --- | --- |
| `/start` 처음부터 끝까지 | 🔌 진행 중 | 새 폴더 · 새 VS Code 창에서. 문제 나오면 바로 고친다 |
| 로컬 메모리 Redis | ✅ | `local_redis_host=memory` — 로컬은 Redis 설치 없이, 운영은 기동 거부 · `/start` 는 Redis 가 없으면 이걸로 |
| 모듈 레시피 | ✅ | 넣기 스케줄러 · AI(Claude · OpenAI · Gemini) / 빼기 OAuth · WebSocket · 업로드 · Docker → `/plan` 이 고른다. 빼기 4개 · 스케줄러는 별도 작업 폴더에서 그대로 따라 해 검사 통과 (Docker 는 검토만) |
| AI 레시피 실제 적용 | 🔌 | `assets/ai/` 를 막 받은 템플릿에 복사하는 한 바퀴 — 다음 커밋 뒤 시험 |
| 레시피 assets 는 CI 밖 | ⬜ | 템플릿 공통 코드(rate_limit · useAPI · settings)를 바꾸면 레시피 시험을 다시 (CI 가 assets 를 안 돌린다) |

## 남은 것

| 무엇 | 상태 | 메모 |
| --- | --- | --- |
| `/autopilot` 실제 한 바퀴 | 🔄 | test2(비품 대여함 · phase 6개)에서 도는 중 — `.claude/` 편집 확인 창 · 백그라운드 에이전트 중 "진전 없음" 이 보였다 (고침, test2 엔 일부만) |
| 밤새 돌리기 | 🔌 | 잠자기 막기(Windows 실제 확인 · macOS · Linux 는 명령만) · 한도 자동 재개(`autoContinueAtUsageLimit` — VS Code 확장도 따르는지 시험 필요) |
| 배포 롤백 실제 서버 | 🔌 | AWS 를 붙인 뒤 첫 배포에서 |
| 하위 에이전트 권한 | ⬜ | 신뢰 전 폴더면 `/plan` 리서치의 웹 검색에서 물을 수 있다 (커맨드 `allowed-tools` 가 안 넘어간다) |
| 안내 페이지 사진 39장 | ⬜ | `docs/guides/img/README.md` 의 이름대로 넣기 |
| sec-reviewer 반증 단계 | ⬜ | 찾은 것을 다른 에이전트가 반박해 오탐 거르기 (공식 claude-security 방식) |
| `nginx -t` | ⬜ | `deploy/` 를 고친 뒤 못 돌렸다 (로컬 Docker 꺼짐) — keepalive map(`0dd969b`)까지 첫 배포 로그로 |
| 나중에 | ⬜ | fe-test-writer · Playwright MCP · 배포 승인 게이트 · 모니터링 · 알림 |
| npm dev 의존성 moderate 3 · eslint 경고 1 | — | 운영 번들 무관 · `googleCallback` 1회 실행 의도 |

## 확인 순서

**1. 기계 검사** — CI 와 같다 (로컬 MySQL · Redis 켜고)

```bash
cd backend  && uv run ruff check . && uv run pytest -q          # 158
cd frontend && npm run check:types && npm run lint && npm test  # vitest 37
cd frontend && npm run build && npm run e2e                     # E2E 10
node --test .claude/hooks/autopilot-gate.test.mjs scripts/dev.test.mjs   # 35 + 2
wsl bash infra/tests/deploy_smoke.sh                            # 16 (Windows 는 WSL — Git Bash 는 심볼릭 링크 불가)
./infra/.bin/1.16.4/terraform -chdir=infra test                 # 2
```

**2. `/start`** — 바탕화면에 새로 받아 새 창으로 열고 "안녕"

| 볼 것 | 정상 |
| --- | --- |
| 첫 답 | "처음이시네요 — …" (시작 훅) |
| 확인 창 | 처음 "Use skill /start?" 한 번 → 2번 누르면 끝까지 없음 |
| git | 커밋 하나 · 원격 없음 |
| 질문 | 전부 선택지 · 요약은 질문 본문에 |
| 자료 | 계약서 · 대화 → `PRD/sources/` (git 제외) · 고정 조건 |
| 비밀번호 | 메모장으로 열고 적게 · 대화로 안 물음 |
| Redis | 이미 있으면 같이 씀 · 없으면 메모리 (설치 안 함) · Docker 는 MySQL 이 없을 때만 |
| 끝 | pytest · E2E 통과 → `/plan` |

**3. `/autopilot`** — 장난감 `PROJECT.md` 로 한 바퀴 (옆 폴더)

```markdown
## phase 1: 공지
**완료 기준**: - [ ] F1-1 관리자는 공지를 만든다 (201) - [ ] F1-2 로그인 없이 목록을 본다 - [ ] F1-3 일반 사용자는 못 만든다 (403)
## phase 2: 공지 화면
**완료 기준**: - [ ] F2-1 첫 화면에 최신 공지 3개
```

`PROGRESS.md`(`## phase 1: 공지` · `## phase 2: 공지 화면`, `- 상태: ⬜ 대기`) · `DECISIONS.md`(`## ⛔ 막힌 곳`)도 두고 커밋 → `/autopilot`.

| 볼 것 | 정상 |
| --- | --- |
| 턴을 끝내려 할 때 | `[autopilot run … · phase-1 …]` 지시로 계속 |
| phase 마다 | 커밋 제목에 `phase N` · `- 검증:` 줄 · `e2e/phase-N.spec.ts` 이름이 `F1-…` |
| 끝 | `DECISIONS.md` 맨 위 `🌙 무인 실행 결과` · 휴대폰 페이지 · `status` 꺼짐 |
| `git push` 시키면 | PreToolUse 가 막음 |

**4. 배포 롤백** — 1 의 스모크 16개 = 정상 배포 · 확인 실패 복귀 · nginx · 마이그레이션 실패 · 3개 정리 · `rollback.sh` · 예전 구조 전환

## 지난 기록

| 묶음 | 내용 | 상태 |
| --- | --- | --- |
| A — 없으면 안 됨 (2026-09 감사) | 스키마 · 검증 에러 · 직렬화 · CSRF · 레이트리밋 · 세션 무효화 | ✅ |
| B — 있으면 좋음 | compose · CI · ruff · uv · vitest · 페이지네이션 · 업로드 · TimestampMixin · 에러코드 · 실행 스크립트 | ✅ |
| C — 정리 | 죽은 코드 · 가드 중복 · 미사용 의존성 | ✅ |
| D1–7 — zero-to-one | 에이전트 · `/plan` · 프론트 · 외부 API · 검증 · 보안 · E2E | ✅ |
| D8 — 무인 실행 | `/autopilot` · 게이트 | 🔌 |
| D9 — 배포 롤백 | 릴리스 폴더 · 자동 복귀 | 🔌 |
| D10 — 배포 스킬 | `skills/deploy/` | ✅ |
| D11 — `/start` | 처음 쓰는 사람의 입구 | 🔌 |

원칙 몇 가지 — 주제 지식은 스킬, 에이전트는 역할 · 권한 · 시점이 다를 때만 나눈다 · 사람이 안 볼 때 지켜 줄 장치부터 만든다 ·
무인으로 넘지 않는 선은 실제 결제 키 · 운영 배포 · main merge.
