---
description: 프론트엔드 UI + API 연동 구현. /design [기능 설명]
---

$ARGUMENTS 기능을 프론트엔드에 구현하세요:

1. **researcher** 호출 → 관련 프론트 코드 탐색 (재사용 컴포넌트, 타입, 훅 확인)
2. **builder** 호출 → 타입 정의 → 컴포넌트 → 컨테이너 → API 연동

API 호출은 반드시 `useGet` / `usePost` (`@/hooks/common/useAPI`) 사용.
공통 컴포넌트 있으면 반드시 재사용.
터미널 명령 실행 금지.
완료 후 생성된 파일 목록 보고.
