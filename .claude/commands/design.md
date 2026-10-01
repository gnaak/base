---
name: design
description: 프론트 UI 구현. 프론트 작업 요청 시 사용.
---

$ARGUMENTS 기능을 구현하세요:

1. 디자인 규칙을 먼저 읽는다
   - 관리자 화면: 루트 `DESIGN.md` (토큰·간격·컴포넌트 규칙)
   - 고객 화면: `PRD/04_DESIGN.md` 가 있으면 그것이 우선 (`.theme-client` 범위의 값과 원칙)
   - `PRD/03_PAGE.md` 가 있으면 만들 페이지의 행(라우트·대상·F-ID·UI 패턴)
2. fe-researcher 호출 → 관련 코드 탐색
3. fe-ui-builder 호출 → 컴포넌트/컨테이너 작성

터미널 명령 실행 금지.
완료 후 생성된 파일 목록과 만든 페이지(P-ID) 보고.
