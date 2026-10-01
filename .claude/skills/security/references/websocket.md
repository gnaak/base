# WebSocket

목표: 아무나 남의 방에 들어가 메시지를 보거나 보내지 못하고, 다른 사이트가 사용자의 쿠키로 소켓을 열지 못한다.

## 어디를 보나

- `backend/app/module/web_socket/web_socket_router.py`, `web_socket_service.py`, `manager.py`
- `backend/app/core/provider/web_socket/deps.py` — `WSProvider` / `UserWSProvider` / `AdminWSProvider`
- `deploy/site.conf` 의 `location /api/ws`

## 체크리스트

- [ ] 개인 데이터가 오가는 소켓은 `UserWSProvider`/`AdminWSProvider` 로 인증한다 (`WSProvider` 는 무인증)
- [ ] **방(room) 입장 권한을 서버가 확인한다** — 쿼리로 받은 `room_id` 에 그 사용자가 속하는지. 없으면 ❌
- [ ] **Origin 을 확인한다** — 쿠키 인증 소켓은 브라우저가 다른 사이트에서도 쿠키를 싣는다(CSWSH).
      Origin 이 CORS 오리진 목록에 없으면 연결을 거부한다
- [ ] 메시지 크기·빈도 상한이 있다 (거대한 메시지·연타로 브로드캐스트 폭주) — ⚠️
- [ ] 연결 수 상한 (nginx `limit_conn` 또는 앱) — ⚠️
- [ ] 메시지 본문 전체를 로그에 남기지 않는다 (개인정보)
