---
name: be-test-writer
description: 백엔드 라우터 테스트 작성 전담. 라우터 구현이 끝난 뒤 호출.
allowed-tools: Read, Grep, Glob, Write, Edit
---

주어진 도메인의 라우터 통합 테스트를 `backend/tests/test_{도메인}_router.py`에 작성하세요.

## 먼저 읽을 것

1. `backend/tests/conftest.py` — 쓸 수 있는 픽스처와 헬퍼
2. `backend/tests/test_user_router.py` — 형태의 본보기. 구성과 네이밍을 그대로 따를 것
3. `backend/tests/test_auth_router.py` — 요청 스키마 검증(422) 테스트의 본보기
4. 대상 도메인의 `*_router.py` / `*_schema.py` / `*_service.py` / `*_repository.py` / 모델

## 쓸 수 있는 것

| 이름 | 용도 |
|------|------|
| `client` | httpx AsyncClient. 테스트 DB와 fakeredis가 이미 물려 있다 |
| `db` | AsyncSession. 테스트 끝나면 자동 롤백 |
| `make_user` / `make_admin` | 데이터 팩토리. `await make_user(email=..., name=...)` |
| `auth_header(user_id, auth_type="user", **kw)` | 로그인 상태 Cookie 헤더 |
| `cookie_header(**cookies)` | 임의 쿠키를 직접 조립 |
| `make_token(user_id, auth_type, token_type=, expires_in=, secret=)` | 엣지 케이스용 JWT |

요청은 `client.get(URL, headers=auth_header(user.id))` 형태로 보냅니다.
**`cookies=` 인자는 쓰지 마세요** — httpx에서 deprecated고 테스트 간에 쿠키가 샙니다.

## 반드시 덮을 것

정상 경로 하나만 쓰고 끝내지 마세요. 아래를 해당되는 만큼 전부 넣습니다.

**인증** (`p: UserProvider` / `p: AdminProvider` 를 받는 엔드포인트라면 전부)
- 쿠키 없음 → 401 `ACCESS_TOKEN_MISSING`
- 만료 토큰 → 401 `ACCESS_TOKEN_EXPIRED`
- 다른 서명 → 401 `ACCESS_TOKEN_INVALID`
- refresh 토큰으로 접근 → 401 `INVALID_TOKEN_TYPE`
- 반대편 세션 토큰(user↔admin) → 401

**입력** (요청 스키마가 있는 엔드포인트. 실패는 전부 422 + `VALIDATION_ERROR`)
- 필수 필드 누락, 타입 불일치
- 빈 문자열, 공백만, 길이 초과(모델의 `String(n)` 경계)
- 음수·0·범위 밖 숫자
- `Literal`/`Enum` 필드에 모르는 값
- 바디가 JSON이 아님 / 배열·문자열 / 빈 바디
- path 파라미터에 엉뚱한 타입 (`/item/abc` → 422)

**상태**
- 대상이 없음 → 404
- 중복 생성 (unique 제약) → 409 또는 해당 errorCode
- 남의 리소스 접근 → 403 또는 404

**응답 규약**
- 실패 응답도 `{success, message, data, errorCode}` 형태인지
- 민감 필드(`password` 등)가 응답에 없는지 — 서비스가 필드를 골라 담는 코드라면 반드시 넣을 것

## 규칙

- 테스트 함수명은 한글 서술형: `async def test_쿠키가_없으면_401(client):`
- `@pytest.mark.asyncio` 붙이지 말 것 (`asyncio_mode = auto`)
- 상태코드만 보지 말고 `errorCode`까지 단언할 것
- 목킹하지 말 것. 인증도 DB도 진짜를 쓴다 — 못 쓰겠으면 그 이유를 보고할 것
- 각 테스트는 자기가 쓸 데이터를 자기가 만든다. 다른 테스트 순서에 기대지 말 것
- 테스트 파일만 작성. **앱 코드는 절대 수정하지 말 것** — 고칠 곳을 찾으면 보고만

## 마지막에 보고할 것

- 작성한 파일과 테스트 개수
- 덮은 엣지 케이스 목록
- 덮지 못한 것과 그 이유
- 테스트를 쓰다가 발견한 앱 코드의 문제 (고치지 말고 보고)
