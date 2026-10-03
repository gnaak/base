# OAuth (Google · Kakao)

목표: 공격자가 피해자를 **공격자 계정으로 로그인시키거나**(login CSRF), **남의 계정을 이메일로 가로채지** 못한다.

## 흐름 (이 템플릿)

프론트 `hooks/auth/googleLogin.tsx`·`kakaoLogin.tsx` 가 인가 URL 로 보냄 → 업체가 `/{google|kakao}/login?code=…` 로 돌려보냄 →
`hooks/auth/googleCallback.tsx`·`kakaoCallback.tsx` 가 code 를 `POST /api/auth/{google|kakao}` 로 → 백엔드
`module/infra/{google|kakao}/*_service.py` 가 토큰 교환·사용자 정보 → `user_repository.get_or_create_oauth_user` 가 **이메일로** 계정을 찾거나 만든다

## 체크리스트

- [ ] **`state` 가 있다** — 인가 요청 때 무작위 값을 만들어 저장(sessionStorage 등)하고, 콜백에서 같은지 확인한 뒤에만 code 를 보낸다.
      없으면 ❌ login CSRF (`/kakao/login?code=<공격자 code>` 링크 하나로 피해자가 공격자 계정에 로그인)
- [ ] `state` 에 `next`(돌아갈 곳)를 실었다면 **같은 오리진의 경로만** 허용한다 (`/` 로 시작하고 `//` 가 아님) — 아니면 ⚠️ 오픈 리다이렉트
- [ ] **이메일 검증 여부를 본다** — Google `verified_email`, Kakao `kakao_account.is_email_verified`·`is_email_valid`.
      검증 안 된 이메일로 기존 계정에 연결하면 ❌ 계정 선점 (공격자가 피해자 이메일로 먼저 가입·연결)
- [ ] `redirect_uri` 는 서버 설정값으로 교환한다 (클라이언트가 보낸 값을 쓰지 않는다)
- [ ] 업체 에러 본문을 클라이언트에 그대로 주지 않는다 (`request_json` 이 요약만 준다)
- [ ] OAuth 엔드포인트에 빈도 제한(`LOGIN_LIMIT`)이 걸려 있다

## 확인 방법

- Grep `state` in `frontend/src/hooks/auth/`, `backend/app/module/auth/`
- Read `module/infra/google/google_service.py`, `module/infra/kakao/kakao_service.py` 의 사용자 정보 파싱 부분
