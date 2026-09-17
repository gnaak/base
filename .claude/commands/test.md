---
name: test
description: 백엔드 라우터 테스트 작성 후 실행. 라우터 구현이 끝났을 때 사용.
---

$ARGUMENTS 도메인의 라우터 테스트를 작성하고 돌리세요.

1. be-researcher 호출 → 대상 라우터/서비스/리포지토리/모델 파악
2. be-test-writer 호출 → `backend/tests/test_{도메인}_router.py` 작성
3. 테스트 실행:

   ```bash
   cd backend && .venv/Scripts/python.exe -m pytest tests/test_{도메인}_router.py -v
   ```

   (venv가 없으면 `python -m pytest`)

4. 결과 처리:
   - **전부 통과** → 통과한 케이스 목록 보고하고 종료
   - **테스트가 잘못됨** → be-test-writer를 다시 호출해 수정. 최대 2회
   - **앱 코드 버그** → 고치지 말고 멈출 것. 실패한 테스트, 기대값과 실제값,
     원인으로 보이는 파일·라인을 보고하고 **고칠지 물어볼 것**

테스트가 앱 코드의 버그를 잡은 거라면 그게 성과다. 테스트를 기대값에 맞춰
느슨하게 고쳐서 통과시키지 말 것.

완료 후 보고:
- 작성한 파일과 테스트 개수
- 통과/실패 내역
- 덮지 못한 케이스와 이유
- 발견한 앱 코드 문제 (있다면)
