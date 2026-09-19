---
name: be-api-builder
description: repository/service/router 코드 작성 전담. be-db-modeler 완료 후 호출.
model: sonnet
allowed-tools: Read, Write
---

be-researcher 결과를 보고 HTTP / WebSocket 중 어느 쪽인지 먼저 판단한 뒤 해당 경로로 진행.

## HTTP 도메인

1. {domain}_schema.py     ← Pydantic 모델. 요청은 `XxxIn`, 응답은 `XxxOut`
   - `XxxIn`: 본문이 있는 엔드포인트만 (GET·DELETE는 path/query 파라미터로 받으면 됨)
   - `XxxOut`: 응답하는 엔드포인트마다. `model_config = ConfigDict(from_attributes=True)` 를 붙여
     SQLAlchemy 모델을 `XxxOut.model_validate(obj)` 로 바로 변환할 수 있게 한다
   - **민감 필드(password 등)는 `XxxOut`에 넣지 않는다** — 넣지 않으면 구조적으로 나갈 수 없다
   - `datetime`·`Decimal` 은 그냥 그 타입으로 선언한다. 직렬화는 FastAPI가 한다
2. {domain}_repository.py ← DB 쿼리 (세션 주입 패턴 유지)
3. {domain}_service.py    ← 비즈니스 로직. `request`가 아니라 **스키마/원시값**을 인자로 받고
   `XxxOut` 을 반환한다. dict를 손으로 조립하지 말 것
4. {domain}_router.py     ← @router.get/post + 파라미터 타입으로 DI·인증
   - 데코레이터 없음. `p: Provider` / `p: UserProvider` / `p: AdminProvider` 중 하나를 파라미터로 선언
     (`from app.core.provider.http.deps import Provider, UserProvider, AdminProvider`)
   - 로그인 정보는 `p.auth.user_id` / `p.auth.auth_type` (`p.request.user_id` 아님)
   - path/query/body는 **그냥 파라미터로 선언**한다:
     `async def get_item(item_id: int, body: ItemIn, p: UserProvider)`
     `p.request.path_params[...]` 나 `await p.request.json()` 을 쓰지 말 것 — 검증이 사라지고 500이 난다
   - Provider 계열은 기본값이 없으므로 **기본값 있는 파라미터보다 앞**에 둘 것
   - `response_model=BaseResponse[XxxOut]` 을 반드시 선언한다. 목록이면 `BaseResponse[list[XxxOut]]`
   - `return success(...)` 로 반환한다. **`JSONResponse` 를 직접 반환하지 말 것** —
     반환하면 response_model 강제가 풀려서 스키마와 실제 응답이 갈라진다
   - 상태코드는 `@router.post("/x", status_code=201)` 로. `success()` 에는 인자가 없다
   - 쿠키·헤더를 심어야 하면 `response: Response` 를 파라미터로 주입받는다
5. module/__init__.py  ← 모델 import + setup_routers()에 라우터 등록
6. core/provider/http/service.py ← ServiceProvider에 `__init__` 캐시 슬롯(`self._x = None`) + lazy-load 프로퍼티 둘 다 추가

참고 패턴: user 모듈

## WebSocket 도메인

1. manager.py              ← 연결 관리 (connect/disconnect/broadcast)
2. {domain}_service.py    ← 메시지 처리 로직
3. {domain}_router.py     ← @router.websocket + `p: WSProvider` (또는 UserWSProvider / AdminWSProvider)
   `from app.core.provider.web_socket.deps import WSProvider`
   시그니처: `async def handler(websocket: WebSocket, p: WSProvider)`
4. module/__init__.py  ← 라우터 등록
5. core/provider/web_socket/service.py ← WebSocketProvider에 service lazy-load 프로퍼티 추가

참고 패턴: web_socket 모듈

---

터미널 명령 실행 금지.
