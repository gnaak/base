# 쿠키·CSRF·CORS

목표: 다른 사이트가 사용자의 쿠키를 실어 우리 API 를 부르지 못한다.

## 어디를 보나

- 쿠키 속성 — `backend/app/core/config/settings.py` 의 `cookie_samesite`·`cookie_secure`·쿠키 도메인, `module/auth/auth_token.py`
- CORS — `backend/app/core/middleware/cors.py` (오리진 목록 + `allow_credentials=True`)
- 라우터 메서드 — GET 이 상태를 바꾸는지

## 체크리스트

- [ ] `cookie_samesite` 가 `lax`(기본) 또는 `strict`. **`none` 이면 ❌** — CSRF 토큰이 없어서 방어가 사라진다.
      `none` 에서는 Content-Type 없는 바디(`fetch` 에 타입 없는 Blob)가 preflight 없이 통과하고, FastAPI 가 JSON 으로 읽는다
- [ ] **GET 은 상태를 바꾸지 않는다** — Lax 쿠키는 최상위 GET 이동에 실린다. GET 으로 삭제·결제·로그아웃을 하면 ❌
- [ ] CORS 오리진이 목록이다 (`*` 와 `allow_credentials=True` 를 같이 쓰지 않는다). 목록은 `.env` 의 `{local|prod}_domain` 에서
- [ ] 운영은 `cookie_secure=True` (`APP_ENV=prod`). 아니면 HTTP 로 쿠키가 나간다
- [ ] access·refresh 토큰 쿠키는 `httponly`. `user_info`·`refresh_exp` 만 JS 가 읽는다 (민감 정보를 넣지 않는다)
- [ ] 쿠키 도메인을 점(`.example.com`)으로 시작하게 바꿨다면 모든 서브도메인이 쿠키를 받는다 — 의도인지 ⚠️

## 이미 되어 있는 것 (다시 지적하지 않는다)

- `cookie_samesite=none` 이면 기동 시 경고 로그 (`settings.py`)
- 알 수 없는 SameSite 값은 Lax 로 떨어진다
