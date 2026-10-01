# 권한·소유권 (IDOR)

목표: 로그인한 사용자가 **남의 리소스**에 닿지 못하고, 사용자 세션으로 **관리자 기능**에 닿지 못한다.

## 어디를 보나

- 라우터의 Provider 타입 — `backend/app/core/provider/http/deps.py` 의 `Provider` / `UserProvider` / `AdminProvider`
- 서비스·리포지토리에서 ID 로 조회하는 곳 — `get(id)`, `select(Model).where(Model.id == x)`
- 프론트 가드 `frontend/src/hooks/auth/privateRoute.tsx` — 편의일 뿐, 백엔드에 같은 검사가 있는지

## 체크리스트

- [ ] 상태를 바꾸거나 개인 데이터를 주는 엔드포인트가 `p: Provider`(무인증)로 선언돼 있지 않다 — Grep: `p: Provider\b`
- [ ] 관리자 기능은 `p: AdminProvider`. 사용자 세션 토큰으로 부르면 401/403
- [ ] **경로·쿼리·바디로 받은 ID 로 조회한 뒤 소유자를 확인한다** — `obj.user_id == p.auth.user_id` 가
      쿼리 조건(`where(... user_id == p.auth.user_id)`)에 있거나 조회 직후에 있다. 없으면 ❌ IDOR
- [ ] 남의 리소스면 404 (존재 여부를 흘리지 않게 403 보다 404 를 권장) — 테스트가 있는지 (`tests/test_*_router.py` 의 "남의 리소스")
- [ ] 목록 API 가 사용자 범위로 걸러진다 (전체를 주고 프론트에서 거르지 않는다)
- [ ] 역할이 더 있으면(사장님 등) 역할 검사가 서비스 한 곳에 모여 있다 — 라우터마다 흩어져 있으면 ⚠️
- [ ] `deleted_at` 이 있는 모델은 조회에서 `deleted_at.is_(None)` 을 건다 — 지운 남의 데이터가 다시 보이지 않게
- [ ] 응답 스키마(`XxxOut`)에 남의 식별자·내부 필드(비밀번호 해시, 내부 메모)가 없다

## 흔한 실수

- `/api/orders/{order_id}` 에서 `order_id` 로만 찾고 소유자를 안 본다
- 수정·삭제는 막았는데 조회(GET)를 열어 둔다
- 관리자용 엔드포인트를 만들면서 `UserProvider` 를 복사해 둔다
