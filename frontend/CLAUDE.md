# Frontend — CLAUDE.md

React 19 + TypeScript + Vite + TanStack Query v5 + Tailwind CSS v3 + lucide-react

## 폴더 구조

```
src/
├── App.tsx                  # 루트 라우터
├── container/               # 라우터 연결 페이지 (비즈니스 로직 + 훅)
│   ├── admin/               # layout, login, main, group
│   └── client/              # layout, main, auth/(google, kakao)
├── component/               # 순수 UI (props만 받아 렌더링)
│   └── admin/               # layout/ modal/ ui/(feedback, form, table, loading, pagination)
├── hooks/
│   ├── auth/                # OAuth 로그인·콜백, publicRoute
│   └── common/              # useAPI.ts useAuth.ts getCookie.ts useAudioWs.ts
├── context/AuthProvider.tsx
├── types/                   # auth.ts user.ts admin/
└── utils/format/            # date.ts number.ts time.ts
```

`component/admin/ui/`의 컴포넌트(button, inputbox, modal, table 등)는 참고용.
프로젝트마다 필요한 컴포넌트를 새로 만들어 사용해도 된다.

## 코딩 컨벤션

**경로 alias**: `@/*` → `src/*`, `container/*` → `src/container/*`

**API 호출** — `@/hooks/common/useAPI` (`useGet` `usePost` `usePatch` `useDelete`)
```typescript
const { data, isLoading } = useGet<MyType>("/api/resource", ["query-key"]);
const mutation = usePost<ReqType, ResType>("/api/resource");
mutation.mutate(payload, { onSuccess: () => {}, onError: () => {} });
// 응답: BaseResponse<T> = { success, message, data, errorCode }
// 401 자동 토큰 갱신 처리됨
```

**인증 상태** — `@/hooks/common/useAuth`
```typescript
const { user, isLoading } = useAuth();
```

**컴포넌트 / 훅 정의**
```typescript
const MyComponent = ({ label }: MyComponentProps) => <div>{label}</div>;
export default MyComponent;              // 컴포넌트: 화살표 함수 + default export
export const useMyHook = () => {};       // 훅: named export
// ❌ function 키워드 금지 (App.tsx 제외)
```

**규칙**
- `container/` = 페이지 (로직 + 훅) / `component/` = 순수 UI
- 상태: TanStack Query(서버) + useState(로컬). 전역은 context.
- 타입은 `src/types/`에 정의.

**Tailwind 커스텀 색상**: `main`(#1C1C1C 어두움) / `sub1`(#3A3A3A 중간) / `sub2`(#F2F2F2 밝음)
— `bg-*` `text-*` 및 `-hover` `-active` 변형 사용 가능
