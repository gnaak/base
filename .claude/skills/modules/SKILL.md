---
name: modules
description: "이 템플릿에 기능 모듈을 넣거나 뺀다 — 넣기: 스케줄러(주기 작업 · cron · 매일 새벽 정리 · 마감 시각 처리), AI(Claude · OpenAI · Gemini 채팅 · 요약 · 생성). 빼기: 구글 · 카카오 로그인(OAuth), WebSocket, 파일 업로드, Docker. 흩어진 참조(설정 · Provider · 라우터 · 프론트 · 테스트 · nginx · 인프라 · 문서)를 한 번에 바꾸고 grep 으로 남은 게 없는지 확인한다. '스케줄러 넣어줘', '매일 자동으로', 'cron', '카카오 로그인 빼줘', '웹소켓 안 써', 'Docker 지워', 'AI 채팅 넣어줘', 'Claude API 붙여줘', 'GPT 연동', 'add scheduler', 'remove websocket' 요청과, PROJECT.md phase 의 '모듈' 줄을 구현할 때 사용."
---

# modules — 기능 넣고 빼기

템플릿은 **자주 쓰는 것만 미리 넣어 두고**, 나머지는 필요할 때 레시피로 넣는다. 안 쓰는 것은 레시피로 뺀다.

- 안 쓰는 코드를 남겨 두면 Claude 가 그걸 쓰는 기능인 줄 알고 읽는다. 의존성 · 공격면 · 테스트도 같이 남는다
- 빼기는 참조가 흩어져 있어 하나라도 빠뜨리면 **조용히** 남는다 — 그래서 레시피마다 마지막에 grep 확인이 있다
- 미리 넣어 두지 않는 이유 — 쓰지 않을 프로젝트에서도 빼는 일이 생긴다. 넣는 레시피가 빼는 레시피보다 짧다

## 카탈로그

| 모듈 | 방향 | 레시피 | 언제 |
| --- | --- | --- | --- |
| `scheduler` | 넣기 | `references/scheduler.md` | 정해진 때 도는 일 — 매일 정리 · 매시 집계 · 마감 시각 처리 · 만료 알림 |
| `ai` | 넣기 | `references/ai.md` | AI 채팅 · 요약 · 생성 — 스트리밍 API + 화면 훅 + 사용자별 한도 + 비용 로그. 업체(Claude · OpenAI · Gemini)는 하나만 |
| `oauth` | 빼기 | `references/remove-oauth.md` | 로그인이 이메일(또는 사내 계정)뿐. 구글 · 카카오 중 하나만 뺄 수도 있다 |
| `websocket` | 빼기 | `references/remove-websocket.md` | 실시간 기능(채팅 · 알림 푸시 · 동시 편집)이 없다 |
| `upload` | 빼기 | `references/remove-upload.md` | 파일 · 이미지를 받지 않는다 |
| `docker` | 빼기 | `references/remove-docker.md` | 로컬 MySQL 을 직접 설치해 쓴다 — **사람이 요청할 때만** (운영과 무관 · 처음 쓰는 사람의 셋업 경로) |

**빼면 안 되는 것** — Redis(로그인 한도 · 세션 무효화. 로컬은 `local_redis_host=memory` 로 설치 없이),
MySQL · Alembic, 인증(쿠키 JWT · 관리자), 로깅, 레이트리밋, `http_client`(외부 API 공통).

**레시피가 없는 것** — 결제 · 알림톡 · SMS · 이메일 · 지도 · AI API 연동은 `be-external-api` 에이전트가 맡는다.
S3 업로드 · 백그라운드 작업 큐 · 검색 엔진은 아직 레시피가 없다 — 무인 실행이면 `DECISIONS.md` ⛔ 에 올리고, 대화면 사람에게 묻는다.

## 불변 원칙

1. **레시피 순서대로, 건너뛰지 않는다.** 레시피에 없는 파일을 바꿔야 하면 바꾸고, 레시피를 고친다 (레시피가 틀린 것)
2. **빼기는 마지막 "확인"의 grep 이 0건이어야 끝이다.** 남은 것이 의도면 그 줄을 레시피의 "남겨 두는 것"에 적는다.
   grep 은 `git grep --untracked` — 아직 `git add` 안 한 새 파일도 본다
3. **DB 는 지우지 않는다** — 모듈이 쓰던 컬럼 · 테이블이 있어도 이번에 마이그레이션으로 지우지 않는다.
   "다음 릴리스에서 contract" 로 `DECISIONS.md` 🔍 에 남긴다 (`backend/CLAUDE.md` "되돌릴 수 있게 — expand / contract")
4. **로컬 키는 설정 필드보다 먼저 지운다** — `PP unset <키>` (`--file frontend/.env` 로 프론트). 필드를 먼저 지우면 pytest 부터 기동 거부다.
   **빈 값으로 남은 키는 거부되지 않아 놓친다** — 확인에 `PP line <키>` 가 "줄이 없습니다" 인지 넣는다
5. **운영 값도 같이** — 뺀 설정 키를 Parameter Store `/<project>/backend/*` 에 남겨 두면 `RawEnv` 가 모르는 키라 **기동 거부**다.
   지우는 건 사람이 한다 (`DECISIONS.md` 🧑 에 이름을 적는다). 무인 실행은 운영을 건드리지 않는다
6. **무인 실행 중에는 `.claude/` 아래를 고치지 않는다** — 레시피의 "문서 · 스킬 · 에이전트" 중 `.claude/` 파일(에이전트 · 스킬 · 커맨드 설명)은
   Claude Code 가 편집 자동 승인 모드에서도 **파일마다 따로 묻는다** (시험에서 확인 — 밤새 거기서 멈춘다).
   그 줄들은 남기고 `DECISIONS.md` 🔍 에 "`.claude/` 문서의 {모듈} 언급 정리 — 사람이 있을 때 `modules` 스킬로" 한 줄. 확인 grep 에는 `':!.claude'` 를 더한다.
   설명 문서에 남은 언급은 동작에 영향이 없다. 사람이 대화로 시킨 거면 고친다
7. **검증 명령 전부** — 루트 `CLAUDE.md` 의 검증 명령 (pytest · 타입 · 린트 · vitest · 빌드 · E2E). 프론트를 건드렸으면 E2E 까지

## `/plan` · `/autopilot` 과의 연결

- PRD 10장 "템플릿 적합성"이 카탈로그에서 고른다 — 넣을 것(어느 F-ID 때문에) · 뺄 것(왜 안 쓰는지)
- `PROJECT.md` phase 의 **`**모듈**: +scheduler ← F12 · −websocket · +ai ← F7`** 줄 — 빼기는 phase 1, 넣기는 그 모듈을 처음 쓰는 phase
- 그 phase 를 구현할 때 **기능보다 먼저** 레시피를 끝낸다. `PROGRESS.md` 수행 내용에 "모듈: −websocket (레시피 확인 grep 0건)"

## 보고 형식

```
모듈: −websocket
바꾼 곳: (파일 목록 — 지움 / 고침)
남겨 둔 것: (있으면 이유와 함께. DB 컬럼 · 운영 Parameter Store 등)
확인: grep … 0건 · pytest · 타입 · 빌드 · E2E 결과
사람이 할 것: (Parameter Store 키 삭제 등)
```
