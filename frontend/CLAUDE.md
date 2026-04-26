# Frontend — CLAUDE.md

React 19 + TypeScript + Vite + TanStack Query v5 + Tailwind CSS v3 + lucide-react

## 폴더 구조

```
src/
├── App.tsx                  # 루트 라우터
├── container/               # 라우터 연결 페이지 (비즈니스 로직 + 훅)
│   ├── admin/layout.tsx
│   └── client/layout.tsx, auth/google.tsx, auth/kakao.tsx
├── component/
│   ├── admin/ client/
│   └── common/              # ★ 공통 컴포넌트 — 반드시 사용
│       ├── feedback/        alert.tsx modal.tsx formModal.tsx toast.tsx
│       ├── form/            button.tsx inputbox.tsx selectBox.tsx textareaBox.tsx
│       │                    checkbox.tsx radioButton.tsx toggle.tsx calendar.tsx
│       ├── table/table.tsx
│       ├── loading.tsx
│       └── pagination.tsx
├── hooks/common/            useAPI.ts useAuth.ts getCookie.ts useAudioWs.ts
├── context/AuthProvider.tsx
├── types/                   user.ts auth.ts admin/ user/
└── utils/format/            date.ts number.ts time.ts
```

## 공통 컴포넌트

새 UI 작성 시 아래 컴포넌트가 있으면 **반드시** 사용. 직접 만들지 않는다.

### Feedback

| 컴포넌트 | import | 주요 props |
|----------|--------|------------|
| `<Alert />` | `@/component/common/feedback/alert` | `type("info"\|"success"\|"warning"\|"error")` `size("sm"\|"md"\|"lg")` `title` `description` `closable` `onClose` |
| `<Modal />` | `@/component/common/feedback/modal` | `open` `onClose` `title` `description` `size` `buttonCount(0\|1\|2)` `primaryText` `onPrimary` `secondaryText` `onSecondary` `icon` |
| `<FormModal />` | `@/component/common/feedback/formModal` | `open` `onClose` `title` `headerType("center"\|"left"\|"none")` `footerType(0\|1\|2)` `primaryText` `onPrimary` |
| `<Toast />` | `@/component/common/feedback/toast` | `open` `onClose` `type` `title` `duration(ms, 0=무한)` |

### Form

| 컴포넌트 | import | 주요 props |
|----------|--------|------------|
| `<Button />` | `@/component/common/form/button` | `variant("main"\|"sub1"\|"sub2")` `size("sm"\|"md"\|"lg")` `leftIcon` `full` |
| `<InputBox />` | `@/component/common/form/inputbox` | `value` `onChange` `type` `placeholder` `error` `errorMessage` `leftIcon` |
| `<SelectBox />` | `@/component/common/form/selectBox` | `value` `onChange` `options({label,value}[])` `placeholder` `position("top"\|"bottom")` |
| `<TextareaBox />` | `@/component/common/form/textareaBox` | `value` `onChange` `rows` `error` |
| `<Checkbox />` | `@/component/common/form/checkbox` | `label` `checked` `onChange` |
| `<RadioButton />` | `@/component/common/form/radioButton` | `name` `label` `value` `checked` `onChange` |
| `<Toggle />` | `@/component/common/form/toggle` | `checked` `onChange` `size` |
| `<Calendar />` | `@/component/common/form/calendar` | `value({start,end})` `onChange` `position("top"\|"bottom"\|"left"\|"right")` |
| `<DepartmentTreeSelect />` | `@/component/common/form/departmentTreeSelect` | `value` `onChange` `options` |

### Data Display

| 컴포넌트 | import | 주요 props |
|----------|--------|------------|
| `<Table />` | `@/component/common/table/table` | `columns({key,header,width?,align?,render?,icon?}[])` `data` `size` `striped` `onRowClick` `rowCount` |
| `<Pagination />` | `@/component/common/pagination` | `page` `total` `pageSize` `onChange` |
| `<Loading />` | `@/component/common/loading` | — |

## 코딩 컨벤션

**경로 alias**
```typescript
import Foo from "@/component/...";     // src/ 기준
import Bar from "container/admin/..."; // src/container/ 기준
```

**API 호출**
```typescript
import { useGet, usePost } from "@/hooks/common/useAPI";

const { data, isLoading } = useGet<MyType>("/api/resource", ["query-key"]);

const mutation = usePost<ReqType, ResType>("/api/resource");
mutation.mutate(payload, { onSuccess: () => {}, onError: () => {} });
// 응답: BaseResponse<T> = { success, message, data, errorCode }
// 401 자동 토큰 갱신 처리됨
```

**인증 상태**
```typescript
import { useAuth } from "@/hooks/common/useAuth";
const { user, isLoading } = useAuth();
```

**컴포넌트 / 훅 정의**
```typescript
// ✅ 컴포넌트 — 화살표 함수 + default export
const MyComponent = ({ label }: MyComponentProps) => <div>{label}</div>;
export default MyComponent;

// ✅ 훅 — named export
export const useMyHook = () => {};

// ❌ function 키워드 금지 (App.tsx 제외)
```

**규칙**
- `container/`: 라우터 연결 페이지. 비즈니스 로직 + 훅.
- `component/`: 순수 UI. props만 받아 렌더링.
- 상태: TanStack Query (서버) + useState (로컬). 전역은 context.
- 타입은 `src/types/`에 정의.

**Tailwind 커스텀 색상**
```
bg-main / bg-main-hover / bg-main-active   → #1C1C1C (어두운 배경)
bg-sub1 / bg-sub1-hover / bg-sub1-active   → #3A3A3A (중간 배경)
bg-sub2 / bg-sub2-hover / bg-sub2-active   → #F2F2F2 (밝은 배경)
text-main / text-sub1 / text-sub2          → 텍스트
```
