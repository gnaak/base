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
- Tailwind CSS 사용 (tailwind.config.js 참고)
- 색상은 index.css에 정의된 CSS 변수 활용
- 공통 UI 컴포넌트가 있으면 반드시 재사용, 직접 만들지 않는다
  - feedback: Alert, Modal, FormModal, Toast → /src/component/admin/ui/feedback/
  - form: Button, InputBox, SelectBox, TextareaBox, Checkbox, RadioButton, Toggle, Calendar → /src/component/admin/ui/form/
  - table: Table → /src/component/admin/ui/table/
  - 기타: Pagination, Loading → /src/component/admin/ui/, /src/component/admin/layout/
- 컴포넌트는 화살표 함수 + default export
- 이벤트 핸들러는 handle 접두사
- 터미널 명령 실행 금지
