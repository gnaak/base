# 빼기 — WebSocket

채팅 · 실시간 알림 · 동시 편집 같은 실시간 기능이 없을 때. 프론트에는 WebSocket 클라이언트가 없다 — 백엔드 · nginx · 문서만 바꾼다.
(시험 적용: pytest · ruff · 타입 · 린트 · vitest · 빌드 · terraform test 통과, `/api/ws/` 404)

## 백엔드

| 파일 | 할 일 |
| --- | --- |
| `backend/app/module/web_socket/` | 폴더 삭제 (manager · router · service) |
| `backend/app/core/provider/web_socket/` | 폴더 삭제 (`WSProvider`) |
| `module/__init__.py` | web_socket import 와 `include_router(… "/api/ws")` — 둘 다 |
| `module/auth/auth_token.py` | `get_token_info_ws` (WS provider 만 썼다 — 남기면 조용한 죽은 코드) |
| `main.py` | lifespan 의 `ws_manager.close_all` 주석 |
| `tests/test_web_socket_policy.py` | 파일 삭제 |
| `pyproject.toml` | `websockets` 줄(주석 "uvicorn 의 WebSocket 구현") → `uv --directory backend lock && uv --directory backend sync`. HTTP 는 없어도 돈다 |

남겨 두는 것: `core/middleware/request_id.py` 의 `"websocket"` scope 분기 — ASGI 일반 처리다.

## nginx · 배포 · 인프라 — 같이 지울 짝이 있다

| 파일 | 할 일 |
| --- | --- |
| `deploy/site.conf` | `location /api/ws` 블록 |
| `deploy/nginx.conf` | `ws_conn` limit_conn zone — **site.conf 의 `limit_conn ws_conn` 과 같이.** 하나만 지우면 서버의 `nginx -t` 가 실패한다 (CI 스모크는 가짜 nginx 라 못 잡는다 → 배포가 nginx 설정을 되돌리고 실패) |
| `deploy/nginx.conf` | "WebSocket 업그레이드" map 과 공통 헤더의 `Upgrade` 줄을 지우고 `proxy_set_header Connection "";` 로 (keepalive 유지) |
| `deploy/fastapi.service` | `--timeout 0` 주석의 "WebSocket" — 아래 "스트리밍이 남는지" |
| `infra/aws_edge.tf` · `infra/tests/edge.tftest.hcl` | ALB `idle_timeout = 3600` 주석과 테스트의 `error_message`("WebSocket 이 60초에 끊기지 않게") — 아래 |

**스트리밍(SSE)이 남는지** — AI 채팅(`modules` 의 `ai`)처럼 응답을 길게 흘려보내는 기능이 있으면 `--timeout 0` · ALB 3600 은 **그대로 두고**
주석 · 테스트 메시지만 "SSE" 로. 스트리밍도 없으면 `fastapi.service` 주석이 말하는 대로 `--timeout` 을 60–120 으로,
ALB `idle_timeout` 을 기본(60)으로 되돌리고 tftest 의 기대값도 같이.

## 문서 · 스킬 · 에이전트

`README.md`(API 표 `WS` 행) · `backend/CLAUDE.md`(트리 · WebSocket 절) · `deploy/README.md` · `skills/deploy/references/troubleshoot.md`(끊김 행) ·
`skills/security/SKILL.md`(frontmatter description 의 "WebSocket" · 7단계 — 뒤 단계 번호를 당긴다) + `references/websocket.md` 삭제 ·
에이전트 `be-api-builder`(WebSocket 경로) · `fe-api-connector` · `prd-writer`

## 확인

```bash
git grep --untracked -n -i -E "web_?socket|/api/ws|ws_conn|WSProvider|get_token_info_ws|웹소켓|connection_upgrade" -- . ':!CHANGELOG.md' ':!need.md' ':!backend/uv.lock' ':!frontend/package-lock.json' ':!.claude/skills/modules' \
  | grep -v "request_id\.py"
git ls-files --others --cached --exclude-standard backend/app | grep web_socket   # git rm 뒤 남는 __pycache__ 는 무시된다
```

그리고 루트 `CLAUDE.md` 의 검증 명령. nginx 를 고쳤으니 **첫 배포 로그의 `nginx -t`** 를 사람이 본다 (`DECISIONS.md` 🔍).
