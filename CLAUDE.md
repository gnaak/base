# Base Template — CLAUDE.md

풀스택 프로젝트 베이스 템플릿. 세부 규칙은 `frontend/CLAUDE.md`, `backend/CLAUDE.md` 참고.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + TypeScript + Vite + TanStack Query v5 + Tailwind CSS v3 |
| Backend | FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL + Redis + Alembic |
| 인증 | JWT + OAuth (Google, Kakao) |

## 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 / 클래스 | PascalCase | `UserCard`, `AuthService` |
| 타입 / 인터페이스 | PascalCase | `UserInfo`, `BaseResponse<T>` |
| 함수 / 변수 / 훅 | camelCase | `handleSubmit`, `useAuth` |
| 이벤트 핸들러 | `handle` 접두사 | `handleClick` |
| 폴더명 | camelCase (소문자 시작) | `sideBar/`, `web_socket/` |
| 파일명 (Frontend) | camelCase | `inputbox.tsx`, `useAPI.ts` |
| 파일명 (Backend) | snake_case | `user_service.py` |

## 작업 원칙

1. Phase 단위로 작업. 한 번에 여러 Phase 수행 금지.
2. 매 Phase 완료 시 `agent-progress.md` 업데이트 후 커밋.
3. 테스트 통과 후 다음 Phase 진행.
4. 불확실하면 멈추고 질문.
5. 과도한 추상화 금지.

## Phase 관리

**시작 순서**: `PROJECT.md` 기능 정의 작성 → Claude가 Phase 계획 수립 → 사용자 승인 → Phase 1부터 개발

**Phase 양식**:
```markdown
## Phase N: [이름]
**목표**: ...
**수행 내용**: ...
**완료 기준**: - [ ] ...
**커밋**: `N단계: [설명]`
```

## agent-progress.md 형식

```markdown
## N 단계: [이름]
- 상태: ⬜ 대기 / 🔄 진행중 / ✅ 완료 / ❌ 실패
- 완료 시각:
- 수행 내용:
- 이슈/메모:
```

## 트러블슈팅

| 상황 | 대응 |
|------|------|
| 외부 API 키 없음 | mock 데이터로 fallback, 키 확보 후 교체 |
| 테스트 실패 | 원인 파악 후 수정. 우회 금지 |
| 불명확한 요구사항 | 추측 말고 질문 후 진행 |
| 예상치 못한 파일 발견 | 삭제 전 반드시 확인 요청 |
