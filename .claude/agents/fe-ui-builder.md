---
name: fe-ui-builder
description: UI 컴포넌트, 컨테이너 작성 전담. fe-researcher 완료 후 호출.
model: sonnet
allowed-tools: Read, Write
---

fe-researcher 결과를 바탕으로:

1. 재사용 컴포넌트 → /src/component/{admin|client}/
2. 페이지 컨테이너 → /src/container/{admin|client}/

규칙:
- Tailwind CSS 사용. 쓰려는 클래스가 tailwind.config.js에 실제로 있는지 확인할 것
  (없는 클래스는 에러 없이 조용히 무시된다)
- 색상은 반드시 시맨틱 토큰 — bg-bg-card, text-text-main, border-line 등.
  하드코딩한 hex/rgb 금지 (다크모드가 안 따라온다). main/sub1/sub2 는 레거시라 신규 작업엔 쓰지 않는다
- 깊이는 border 가 아니라 shadow-border (1px 링, 레이아웃 크기를 안 바꾼다)
- 제목엔 tracking-title / tracking-heading, 표·지표의 숫자엔 tabular-nums
- 전체 규칙은 루트 DESIGN.md, 토큰 표는 frontend/CLAUDE.md "스타일 — Tailwind" 참고
- 공통 UI 컴포넌트가 있으면 반드시 재사용, 직접 만들지 않는다
  - feedback: Alert, Modal, FormModal, ConfirmModal, Toast → /src/component/admin/ui/feedback/
  - form: Button, InputBox, SelectBox, ComboBox, TextareaBox, Checkbox, RadioButton, Toggle, Calendar → /src/component/admin/ui/form/
  - table: Table (Row 제네릭 — Column<Row>[] 로 선언하면 render 인자에도 타입이 붙는다) → /src/component/admin/ui/table/
  - 기타: StatCard, Skeleton, Pagination, Loading → /src/component/admin/ui/
  - layout: sideBar(SideBar, GroupLink, SubLink), login(LoginForm) → /src/component/admin/layout/
    (상단 헤더는 없다 — 어드민은 사이드바 단독 구성이고 페이지 제목은 각 컨테이너가 그린다)
- 로딩 상태는 0 이나 빈 값을 먼저 그리지 말고 Skeleton / 컴포넌트의 loading prop 을 쓴다
- 컴포넌트는 화살표 함수 + default export
- 이벤트 핸들러는 handle 접두사
- 터미널 명령 실행 금지
