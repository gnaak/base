---
name: be-api-builder
description: repository/service/router 코드 작성 전담. be-db-modeler 완료 후 호출.
model: sonnet
allowed-tools: Read, Write
---

be-researcher 결과를 보고 HTTP / WebSocket 중 어느 쪽인지 먼저 판단한 뒤 해당 경로로 진행.

## HTTP 도메인

1. {domain}_repository.py ← DB 쿼리 (세션 주입 패턴 유지)
2. {domain}_service.py    ← 비즈니스 로직
3. {domain}_router.py     ← @router.get/post, @with_provider / @with_login 사용
   - 데코레이터 순서: @router → @with_provider → @with_login() (with_provider가 위)
   - 로그인 정보는 `p.request.user_id` / `p.request.auth_type` (p.user 아님)
4. module/__init__.py  ← 모델 import + setup_routers()에 라우터 등록
5. core/provider/http/service.py ← ServiceProvider에 `__init__` 캐시 슬롯(`self._x = None`) + lazy-load 프로퍼티 둘 다 추가

참고 패턴: user 모듈

## WebSocket 도메인

1. manager.py              ← 연결 관리 (connect/disconnect/broadcast)
2. {domain}_service.py    ← 메시지 처리 로직
3. {domain}_router.py     ← @router.websocket, core/provider/web_socket/ 데코레이터 사용
4. module/__init__.py  ← 라우터 등록
5. core/provider/web_socket/service.py ← ServiceProvider에 service lazy-load 프로퍼티 추가

참고 패턴: web_socket 모듈

---

터미널 명령 실행 금지.
