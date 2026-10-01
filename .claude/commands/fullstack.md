---
name: fullstack
description: 백엔드 + 프론트 풀스택 기능 구현.
---

$ARGUMENTS 기능을 구현하세요:

1. be-researcher 호출 → 백엔드 코드 탐색 (외부 업체 연동이 필요한지도 판단)
2. be-db-modeler 호출 → 모델 작성
3. be-api-builder 호출 → schema/repository/service/router 작성
4. **외부 연동이 필요하면** be-external-api 호출 → 업체 클라이언트·웹훅·설정 키·업체 mock 테스트
5. fe-researcher 호출 → 프론트 코드 탐색
6. fe-ui-builder 호출 → 컴포넌트/컨테이너 작성
7. fe-api-connector 호출 → API 연동 및 타입 정의
8. sec-reviewer 호출 → 이번에 만든·고친 파일만 보안 검토 (❌ 가 있으면 보고에 포함)

터미널 명령 실행 금지. (테스트·린트까지 한 번에 보려면 끝난 뒤 `/verify`)
완료 후 생성된 파일 목록과 API 엔드포인트 목록 보고.
