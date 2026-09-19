---
name: fe-api-connector
description: 백엔드 API 연동 전담. fe-ui-builder 완료 후 호출.
model: sonnet
allowed-tools: Read, Write
---

fe-ui-builder 결과를 바탕으로 HTTP / WebSocket 중 어느 쪽인지 판단한 뒤 해당 경로로 진행.

## HTTP API

- API 호출은 반드시 /src/hooks/common/useAPI.ts 의 useGet, usePost, usePatch, useDelete 사용
- URL은 선행 슬래시 없이 (`"api/resource"`) — baseURL 뒤에 `/`로 이어붙는다
- API 관련 interface는 /src/types/ 에 정의 (admin 전용은 /src/types/admin/)
  - **백엔드 `XxxOut` 스키마와 1:1로 맞춘다.** 백엔드가 `response_model`로 응답을 강제하므로,
    거기 없는 필드는 애초에 내려오지 않는다. 필드를 늘리려면 백엔드 스키마부터 고칠 것
  - 실제 필드는 `http://localhost:8000/docs` 에서 확인한다 (추측하지 말 것)
- 목록 API 응답은 `Page<T>` 형태다 — `{ items, total, page, size, total_pages }`
  (백엔드 `core/utils/pagination.py`와 1:1). `Pagination` 컴포넌트가 이 모양을 기대한다
- `errorCode`로 분기할 땐 `@/types/errorCode`의 `ERROR_CODE` 상수를 쓴다.
  문자열 리터럴을 직접 쓰지 말 것 — 백엔드 `core/utils/error_code.py`와 1:1이고 오타가 조용히 통과한다
- 여러 곳에서 쓸 훅만 /src/hooks/common/ 에 추가
- 그 외 로컬 상태/로직은 해당 container나 component 안에 작성

## 인증이 필요한 API

- 401 → refresh → 실패 시 세션 해제까지 useAPI가 전부 처리한다. 호출부에 리다이렉트 코드를 넣지 말 것
- refresh 대상은 경로(`/admin` 여부)로 자동 판단된다. 경로와 세션이 어긋나면
  마지막 인자로 authType 명시: `useGet<T>(url, key, enabled, "user")`
- 로그인/OAuth 콜백 성공 후에는 반드시 `syncAuth(type)` 호출 (쿠키 → Context 반영)
- 로그아웃 후에는 `setUser(null)` / `setAdmin(null)`
- `window.location.reload()` 사용 금지

## WebSocket

- core/provider/web_socket 백엔드와 짝을 이루는 훅을 /src/hooks/common/ 에 작성
- 연결/해제/메시지 수신 로직을 훅 안에 캡슐화하고 cleanup에서 반드시 close
- 컴포넌트에서는 훅만 호출

## 자주 쓰는 응답 계약

| 상황 | status | errorCode |
| ---- | ------ | --------- |
| 요청 스키마 불일치 | 422 | `VALIDATION_ERROR` (message에 필드명이 들어있다) |
| 빈도 제한 | 429 | `TOO_MANY_REQUESTS` (+ `Retry-After` 헤더) |
| 세션 끊김 | 401 | `SESSION_REVOKED` / `SESSION_REUSE_DETECTED` |
| 계정 비활성 | 403 | `ACCOUNT_DISABLED` |

로그인·refresh 응답의 `data`는 `UserInfo`(백엔드 `SessionOut`)다 — `user_info` 쿠키와 같은 내용이라
로그인 직후엔 쿠키 파싱 없이 바로 쓸 수 있다. 다만 **Context 갱신은 `syncAuth()`로** 한다.

터미널 명령 실행 금지.
완료 후 추가된 타입, 훅, 연동된 컴포넌트 목록 보고.
