# 넣기 — AI 채팅 (Claude · OpenAI · Gemini 중 하나)

로그인한 사용자의 대화를 AI 업체에 보내고 답을 **스트리밍(SSE)** 으로 흘려준다. 요약 · 생성 · 상담 챗봇의 바탕.
코드는 레시피 문서가 아니라 **`assets/ai/` 에 실제 파일**로 있다 — 저장소 같은 경로로 복사하고, 기존 파일 몇 곳만 고친다.
(만들 때 확인: pytest 205 · vitest 45 · tsc · eslint · 빌드. 세 업체 다 네트워크 없이 실제 SDK 로 테스트 — 응답 형식을 흉내 낸 가짜 서버)

## 0. 업체 고르기 — 하나만

PRD 10장(또는 사람)이 고른 업체 하나만 넣는다. 고르지 않았으면 `claude`. SDK 마다 끌고 오는 의존성이 달라서 셋 다 넣지 않는다.

| `ai_provider` | 어댑터 · 테스트 | 의존성 (`pyproject.toml`) | 기본 모델 (2026-10) | 알아 둘 것 |
| --- | --- | --- | --- | --- |
| `claude` | `infra/ai/claude.py` · `test_ai_claude.py` | `"anthropic>=1.11.0",` | `claude-opus-5-5` | 1.x 는 `httpx` 가 아니라 **`httpx2`** 위 — 테스트도 `httpx2.MockTransport`. Opus 5.5 는 생각이 항상 켜져 있어 첫 글자까지 몇 초 |
| `openai` | `infra/ai/openai.py` · `test_ai_openai.py` | `"openai>=3.16.2",` | `gpt-6-astra` | `max_tokens` 대신 `max_completion_tokens` (추론 모델이 거부한다) · 사용량은 `[DONE]` 직전 빈 choices 청크 |
| `gemini` | `infra/ai/gemini.py` · `test_ai_gemini.py` | `"google-genai>=2.28.0",` | `gemini-3.8-flash` | **`websockets` 를 <17 로 끌어내린다** · 도구가 없어도 자동 함수 호출이 켜져 있어 어댑터가 끈다 · timeout 단위가 ms |

모델은 설정값(`ai_model`)이다 — 비우면 위 기본값. 업체가 모델을 바꾸면 값 하나로 바꾼다. 비용이 PRD U\* 에 걸리면 `DECISIONS.md` 에.

## 1. 파일 복사 — `assets/ai/` → 저장소 같은 경로

```bash
S=.claude/skills/modules/assets/ai
P=claude   # 0 에서 고른 것
mkdir -p backend/app/module/ai backend/app/module/infra/ai
cp $S/backend/app/module/ai/*.py                 backend/app/module/ai/
cp $S/backend/app/module/infra/ai/__init__.py    backend/app/module/infra/ai/
cp $S/backend/app/module/infra/ai/$P.py          backend/app/module/infra/ai/
cp $S/backend/tests/test_ai_router.py $S/backend/tests/test_ai_$P.py backend/tests/
cp $S/frontend/src/types/ai.ts                   frontend/src/types/
cp $S/frontend/src/hooks/common/useChatStream.ts $S/frontend/src/hooks/common/useChatStream.test.ts frontend/src/hooks/common/
```

| 파일 | 하는 일 |
| --- | --- |
| `module/ai/ai_schema.py` | 요청 — 메시지 40개 · 하나 4000자 · 전체 20000자, 처음과 끝은 user, `system` 역할 거부 (넘으면 422) |
| `module/ai/ai_service.py` | 키 확인 → 사용자 한도(분당 10 · 하루 `ai_daily_limit`, KST 자정) → **첫 글자가 올 때까지 기다렸다가** SSE 시작 → 사용량 로그 |
| `module/ai/ai_router.py` | `POST /api/ai/chat` (UserProvider) — `StreamingResponse`, `X-Accel-Buffering: no` (nginx 버퍼링 끔) |
| `module/infra/ai/__init__.py` | `Usage` · `get_adapter()`(`ai_provider` 이름으로 불러온다) · `close_ai_client()` |
| `module/infra/ai/<업체>.py` | `DEFAULT_MODEL` · `stream()` · `aclose()` — 그 업체 SDK 만 import |
| `frontend/.../useChatStream.ts` | `useChatStream()` → `sendMessage(messages, onText)` · `abort()`. 401 은 refresh 1회(새로고침 없음), 실패는 `ChatStreamError` |

SSE 이벤트는 `text` · `error` · `done` 셋이다 (`ai_service.py` 맨 위 설명과 `useChatStream.ts` 가 1:1).
**첫 글자 전 실패**(키 없음 · 업체 인증 · 연결)는 SSE 가 아니라 평소처럼 상태코드 + JSON(`AI_UNAVAILABLE`) — 그래서 응답 헤더는 첫 글자 뒤에 나간다.

## 2. 기존 파일 고치기

**`backend/app/core/config/settings.py`** — `RawEnv` 에 (`from typing import Literal` 추가):

```python
    # AI 채팅 (module/ai · module/infra/ai/<ai_provider>.py). 키가 비어도 서버는 뜬다 — /api/ai/chat 만 503
    ai_provider: Literal["claude", "openai", "gemini"] = "claude"
    ai_api_key: str | None = None
    ai_model: str = ""  # 비우면 어댑터의 DEFAULT_MODEL
    # 답 하나의 출력 토큰 상한. Claude·OpenAI 추론 모델은 생각(추론) 토큰도 여기에 들어간다 — 작으면 답이 잘린다
    ai_max_tokens: int = Field(default=16000, ge=1)
    ai_daily_limit: int = Field(default=100, ge=1)  # 한 사용자의 하루(KST 자정 기준) 요청 수
    ai_system_prompt: str | None = None
```

`ai_provider` 기본값을 0 에서 고른 것으로. **복사하지 않은 업체를 고르면 첫 요청이 500** 이다 (오타는 기동 거부).

**`backend/app/core/utils/error_code.py`** ↔ **`frontend/src/types/errorCode.ts`** — 양쪽 같이:

```python
    # ── AI 채팅 ───────────────────────────────────────────
    # 키 미설정(503) · 업체 인증·연결·거절(502) · 스트림 도중 끊김(SSE error 이벤트) — 사용자에게는 같은 안내
    AI_UNAVAILABLE = "AI_UNAVAILABLE"
```
```ts
  // AI 채팅
  AI_UNAVAILABLE: "AI_UNAVAILABLE", // 503 키 미설정 · 502 업체 실패 · 스트림 도중 error 이벤트 — "잠시 후 다시"
```

**`backend/app/core/provider/http/service.py`** — `__init__` 에 `self._ai_service = None`, property:

```python
    @property
    def ai_service(self):
        if not self._ai_service:
            from app.module.ai.ai_service import AIService
            from app.module.infra.ai import get_adapter
            self._ai_service = AIService(get_adapter())
        return self._ai_service
```

**`backend/app/module/__init__.py`** — `from app.module.ai import ai_router` + `app.include_router(ai_router.router, prefix="/api/ai")`

**`backend/app/main.py`** — `from app.module.infra.ai import close_ai_client`, lifespan 종료에 `await close_ai_client()` (기동은 SDK 를 불러오지 않는다)

**`backend/app/core/logging/config.py`** — `EXTRA_LOG_CHANNELS` 에 `"ai": "app.module.ai",  # 사용량(토큰) · 업체 오류` → `logs/ai.log`

**`backend/pyproject.toml`** — `# ── 기타 ──` 아래에 0 의 한 줄(주석 포함), 그리고 `uv --directory backend lock && uv --directory backend sync`
(`uv add` 는 파일의 주석 정렬을 바꿔서 쓰지 않는다)

**`backend/.env.example`** — `access_token_minutes` 블록 뒤:

```bash
# ── AI 채팅 (POST /api/ai/chat) ───────────────────────────────
# 선택. ai_api_key 를 비워두면 채팅만 503(AI_UNAVAILABLE)이고 서버는 정상 기동한다.
# ai_provider: claude | openai | gemini — backend/app/module/infra/ai/<이름>.py 가 있어야 한다
# ai_api_key 는 그 업체의 키 (운영은 SSM /<project>/backend/ai_api_key)
ai_provider=claude
ai_api_key=
# 비우면 어댑터의 기본 모델
ai_model=
# 답 하나의 출력 토큰 상한. 추론 모델은 생각 토큰도 여기에 들어간다 — 너무 작으면 답이 잘린다
ai_max_tokens=16000
# 한 사용자의 하루(KST 자정 기준) 요청 수. 분당 10회는 코드에 있다 (ai_service.PER_MINUTE_LIMIT)
ai_daily_limit=100
# 모든 대화 앞에 붙는 시스템 프롬프트 (선택, 한 줄)
ai_system_prompt=
```

공통 코드는 이미 템플릿에 있다 — 사용자 한도 `rate_limit.check_user_limit()`, 프론트 `useAPI.ts` 의 `fetchWithRefresh` · `currentAuthType` export.

## 3. 키 — 대화로 받지 않는다

로컬: `PP line ai_api_key` 로 줄 번호를 얻어 `backend/.env` 를 메모장으로 열고 사람이 적게 한다 (`.env` 에 줄이 없으면 `.env.example` 의 블록을 먼저 옮긴다 — `PP set ai_provider claude` 등은 비밀이 아니라 써도 된다).
키가 없으면 채팅만 503 — 무인 실행은 키 없이 진행하고 `DECISIONS.md` 🧑 에 "AI 키 발급 · Parameter Store `/<project>/backend/ai_api_key`".
운영 값은 Parameter Store `/<project>/backend/ai_provider` · `ai_api_key` · `ai_model` …(이름이 필드와 같아야 한다).

## 4. 문서

- `backend/CLAUDE.md` — infra 표에 `infra/ai/` (어댑터 — 하나만), "AI 채팅" 몇 줄 (SSE 이벤트 셋 · 첫 글자 전 실패는 JSON · 원문은 로그에 안 남긴다)
- `frontend/CLAUDE.md` — API 호출 절의 `useChatStream` 줄을 실제 사용법으로 (`sendMessage(messages, onText)` · `ChatStreamError`)
- `README.md` — API 표에 `POST /api/ai/chat` (user · SSE · 분당 10 · 하루 `ai_daily_limit`)
- `infra/README.md` — Parameter Store 표에 `ai_api_key`
- `PROJECT.md` 해당 phase 의 "모듈" 줄 `+ai` 를 ✅ 로

## 알아 둘 것 (만들 때 확인한 것)

- **원문은 로그에 남기지 않는다** — 프롬프트 · 답에 개인정보가 섞인다. `ai.log` 에는 사용자 · 모델 · 토큰 수만
- 사용자가 창을 닫으면 업체 연결도 닫는다 (생성 = 청구가 거기서 멈춘다). 그때의 사용량은 기록되지 않는다
- 한도는 업체를 부르기 **전에** 센다 — 실패한 호출도 센다 (돈이 나갔을 수 있다). 키 없음은 세지 않는다
- 비용 상한: 요청 하나의 최악은 `ai_max_tokens` × 출력 단가 (Opus 5.5 16000 토큰 ≈ $0.32). 하루 한도와 곱해 사람에게 보인다
- 첫 글자 전 침묵(생각 시간) 동안 keep-alive 가 없다 — Cloudflare 100초 · nginx 300초가 천장. 길게 생각하는 모델이면 `ai_max_tokens` 를 줄인다
- 스트리밍이라 `deploy/fastapi.service` 의 `--timeout 0` 과 ALB `idle_timeout` 3600 이 필요하다 (WebSocket 을 뺀 프로젝트도 이건 남긴다)
- FastAPI 내장 SSE(`EventSourceResponse`)는 쓰지 않았다 — 200 헤더를 먼저 보내서 "첫 글자 전 실패를 JSON 으로" 가 안 된다
- 보안 검토(sec-reviewer)가 볼 것: 키가 프론트로 나가지 않는다(`VITE_` 금지) · 사용자 한도 · 원문 로그 없음 · 시스템 프롬프트를 사용자가 못 바꾼다(`system` 역할 거부)

## 확인

```bash
uv --directory backend lock --locked
uv --directory backend run ruff check .
uv --directory backend run pytest tests/test_ai_router.py tests/test_ai_$P.py -v
npm --prefix frontend run check:types && npm --prefix frontend run lint && npm --prefix frontend test
```

그리고 루트 `CLAUDE.md` 의 검증 명령 전부. 키가 있으면 사람이 한 번: 로그인 → 채팅 화면(또는 `curl -N`)에서 글자가 흘러오는지.
