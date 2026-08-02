# Base Template — CLAUDE.md

풀스택 프로젝트 베이스 템플릿. 세부 규칙은 `frontend/CLAUDE.md`, `backend/CLAUDE.md` 참고.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + TypeScript + Vite 6 + TanStack Query v5 + Tailwind CSS v3 + react-router v7 |
| Backend | FastAPI + SQLAlchemy 2.0 (async) + MySQL(aiomysql) + Redis + Alembic |
| 인증 | 쿠키 기반 JWT + OAuth (Google, Kakao) |

## 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 / 클래스 | PascalCase | `UserCard`, `AuthService` |
| 타입 / 인터페이스 | PascalCase | `UserInfo`, `BaseResponse<T>` |
| 함수 / 변수 / 훅 | camelCase | `handleSubmit`, `useAuth` |
| 이벤트 핸들러 | `handle` 접두사 | `handleClick` |
| 폴더/파일 (Frontend) | camelCase | `sideBar/`, `useAPI.ts` |
| 폴더/파일 (Backend) | snake_case | `web_socket/`, `user_service.py` |

## 인증 계약 (프론트·백엔드 공통)

로그인/refresh 성공 시 백엔드가 내려주는 쿠키 4종. 접두사는 `user_` 또는 `admin_`.

| 쿠키 | httponly | 수명 | 용도 |
|------|----------|------|------|
| `{p}access_token` | ✅ | 1h | API 인증 |
| `{p}refresh_token` | ✅ | 6h | 세션 갱신 |
| `{p}user_info` | ❌ | 1h | 프론트가 읽는 세션 정보 (base64 JSON) |
| `{p}refresh_exp` | ❌ | 6h | "refresh 세션이 살아있다"는 마커 |

- `user_info`의 필드는 `auth_token.create_jwt_token()`의 `session_info`와 프론트 `types/user.ts`의 `UserInfo`가 **1:1로 일치**해야 한다.
- `user_`와 `admin_`은 완전히 독립된 세션이다. 동시에 둘 다 살아있을 수 있다.
- 백엔드가 필드를 추가하면 `UserInfo`도 같이 고칠 것.

**무한 새로고침 주의** — 이 템플릿에서 반복적으로 터졌던 버그다. `user_info` 쿠키가 남아있으면 프론트는 로그인 상태로 믿는데, 토큰이 무효라 API는 401을 준다. 이때 전체 새로고침(`location.reload()` / 같은 URL로 `location.href` 대입)을 하면 쿠키가 그대로라 루프가 돈다.

- 세션 실패 시 **절대 페이지를 새로고침하지 말 것.** `syncAuth()` / `refreshAuth()`로 상태만 갱신한다.
- refresh가 실패하면 `user_info`·`refresh_exp` 쿠키를 지워서 로그인 상태를 확실히 해제한다.
- refresh 재시도는 마운트/요청당 1회로 제한한다.

## 작업 원칙

1. Phase 단위로 작업. 한 번에 여러 Phase 수행 금지.
2. 매 Phase 완료 시 `PROGRESS.md` 업데이트 후 커밋.
3. 테스트 통과 후 다음 Phase 진행.
4. 불확실하면 멈추고 질문.
5. 과도한 추상화 금지.

**검증 명령** (Phase 완료 전 실행):

```bash
cd frontend && npm run check:types
cd frontend && npm run build
```

## Phase 관리

**시작 순서**: `PROJECT.md`에 기능 정의 작성 → Claude가 Phase 계획 수립 → 사용자 승인 → Phase 1부터 개발

> `PROJECT.md`, `PROGRESS.md`는 템플릿에 없다. 새 프로젝트를 시작할 때 만든다.

**Phase 양식** (`PROJECT.md`):
```markdown
## Phase N: [이름]
**목표**: ...
**수행 내용**: ...
**완료 기준**: - [ ] ...
**커밋**: `N단계: [설명]`
```

**진행 기록 양식** (`PROGRESS.md`):
```markdown
## N 단계: [이름]
- 상태: ⬜ 대기 / 🔄 진행중 / ✅ 완료 / ❌ 실패
- 완료 시각:
- 수행 내용:
- 이슈/메모:
```

## 새 프로젝트로 가져갈 때 교체할 것

| 위치 | 내용 |
|------|------|
| `backend/.env` / `frontend/.env` | DB·JWT·OAuth 키 전부. **`jwt_secret`·`hash_key`는 프로젝트마다 새로 생성할 것** |
| `backend/.env` → `prod_cors_origins` | 운영 도메인. 비어 있으면 브라우저 요청이 전부 CORS로 막힌다 |
| `backend/.env` → `prod_cookie_domain` | 같은 호스트면 비워둔다. 서브도메인을 넘나들 때만 `.example.com` |
| `backend/.gitignore` | `alembic/versions/*.py` 제외 줄을 **삭제.** 템플릿에서만 유효한 설정이고, 안 지우면 마이그레이션이 커밋되지 않는다 |
| `frontend/.env.production` | `VITE_APP_PUBLIC_BASE_URL`이 비어 있음 |
| `frontend/src/container/admin/layout.tsx` | `adminMenu` 샘플 메뉴 |
| `docker-compose.yml` | DB 이름·비밀번호 (`backend/.env`의 `local_*`과 일치시킬 것) |

**배포 시 `APP_ENV=prod`를 반드시 명시할 것.** 안 주면 호스트명으로 추측하는데, 이 추측은 EC2
기본 호스트명에서만 맞는다. Docker·Cloud Run에 올리면 조용히 `local`로 떨어져서 쿠키가
`secure=False` / `SameSite=Lax`로 나가고 세션이 안 잡힌다. 기동 로그에 인식된 env와 쿠키 설정이
찍히니 배포 후 한 번 확인할 것.

**로컬 개발 시**: 프론트와 백엔드 호스트를 반드시 통일할 것 (`localhost`끼리 또는 `127.0.0.1`끼리). 섞으면 cross-site가 돼서 `SameSite=Lax` 쿠키가 안 실리고, 로그인은 성공하는데 세션이 안 잡히는 증상이 난다.

## 트러블슈팅

| 상황 | 대응 |
|------|------|
| 로그인은 200인데 세션이 안 잡힘 | 쿠키 자체가 저장됐는지 확인 (도메인·SameSite·호스트 불일치) |
| 무한 새로고침 / 401 반복 | 위 "무한 새로고침 주의" 참고. `user_info` 쿠키가 남아있는지부터 확인 |
| 외부 API 키 없음 | mock 데이터로 fallback, 키 확보 후 교체 |
| 테스트 실패 | 원인 파악 후 수정. 우회 금지 |
| 불명확한 요구사항 | 추측 말고 질문 후 진행 |
| 예상치 못한 파일 발견 | 삭제 전 반드시 확인 요청 |
