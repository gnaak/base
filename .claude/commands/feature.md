---
name: feature
description: 백엔드 도메인 기능 구현. 백엔드 작업 요청 시 사용.
---

$ARGUMENTS 기능을 구현하세요:

1. be-researcher 호출 → 관련 코드 탐색 (외부 업체 연동이 필요한지도 판단)
2. be-db-modeler 호출 → 모델 작성
3. be-api-builder 호출 → schema/repository/service/router 작성
4. **외부 연동이 필요하면** be-external-api 호출 → 업체 클라이언트·웹훅·설정 키·업체 mock 테스트
   (결제·알림톡·SMS·지도·AI API 등. be-api-builder 와 같은 도메인을 함께 만든다 — 업체 호출은 `module/infra/{업체}/` 로)

스키마(`XxxIn`/`XxxOut`)와 `response_model`이 빠지면 `/docs`와 검증이 비므로,
be-api-builder 보고에 그 두 가지가 포함됐는지 확인할 것.
외부 연동이 있으면 be-external-api 보고에 **타임아웃(결과 불명) 처리 방식**과 **사람이 할 것(키 발급·웹훅 등록)** 이 있는지 확인할 것.

터미널 명령 실행 금지.
완료 후 생성된 파일 목록과 API 엔드포인트 목록 보고.
