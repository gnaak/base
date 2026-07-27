# Frontend — CLAUDE.md

React 19 + TypeScript + Vite 6 + TanStack Query v5 + Tailwind CSS v3 + react-router v7 + lucide-react

## 폴더 구조

```
src/
├── App.tsx                  # 루트 라우터 (여기만 function 키워드 허용)
├── container/               # 라우터 연결 페이지 (비즈니스 로직 + 훅)
│   ├── admin/               # layout, login, main, group
│   └── client/              # layout, main, auth/(google, kakao)
├── component/               # 순수 UI (props만 받아 렌더링)
│   └── admin/               # layout/ modal/ ui/(feedback, form, table, loading, pagination)
├── hooks/
│   ├── auth/                # OAuth 로그인·콜백, publicRoute
│   └── common/              # useAPI.ts useAuth.ts getCookie.ts
├── context/AuthProvider.tsx
├── types/                   # auth.ts user.ts admin/
└── utils/format/            # date.ts number.ts time.ts
```

`component/admin/ui/`의 컴포넌트(button, inputbox, modal, table 등)는 참고용.
프로젝트마다 필요한 컴포넌트를 새로 만들어 사용해도 된다.

## 코딩 컨벤션

**경로 alias**: `@/*` → `src/*`, `container/*` → `src/container/*`

**컴포넌트 / 훅 정의**
```typescript
const MyComponent = ({ label }: MyComponentProps) => <div>{label}</div>;
export default MyComponent;              // 컴포넌트: 화살표 함수 + default export
export const useMyHook = () => {};       // 훅: named export
// ❌ function 키워드 금지 (App.tsx 제외)
```

**규칙**
- `container/` = 페이지 (로직 + 훅) / `component/` = 순수 UI. 컴포넌트가 API를 직접 호출하게 되면 컨테이너로 로직을 올릴 것
- 상태: TanStack Query(서버) + useState(로컬). 전역은 context
- 타입은 `src/types/`에 정의

## API 호출 — `@/hooks/common/useAPI`

`useGet` `usePost` `usePatch` `useDelete` (+ SSE용 `useChatStream`)

```typescript
const { data, isLoading } = useGet<MyType>("api/resource", ["query-key"]);
const mutation = usePost<ReqType, ResType>("api/resource");
mutation.mutate(payload, { onSuccess: () => {}, onError: () => {} });
```

- URL은 `baseURL` 뒤에 `/`로 이어붙는다 → **선행 슬래시 없이** `"api/resource"`
- 모든 요청은 `credentials: "include"`
- 응답: `BaseResponse<T> = { success, message, data, errorCode }` — 훅은 `data`만 꺼내 반환
- `success: false`면 throw

**401 처리** — 훅이 자동으로 처리한다. 호출부에서 신경 쓸 게 없다.

1. 401 → refresh 1회 시도 → 성공하면 원 요청 재시도
2. refresh 실패(또는 재시도도 401) → `user_info`·`refresh_exp` 쿠키를 지우고 `AuthExpiredError` throw
3. AuthProvider가 이를 감지해 `user`/`admin`을 `null`로 만든다 → **라우트 가드가 로그인 화면으로 보낸다**

refresh 대상(user/admin)은 기본적으로 `window.location.pathname`이 `/admin`으로 시작하는지로 판단한다.
`/admin` 화면에서 user API를 부르는 것처럼 경로와 세션이 어긋나면 마지막 인자로 명시할 것:

```typescript
useGet<T>("api/user/me", ["me"], true, "user");   // enabled 다음이 authType
usePost<Req, Res>("api/user/thing", "user");      // mutation은 url 다음
```

- `AuthExpiredError`는 재시도해도 결과가 같으므로 React Query 재시도에서 제외된다
- 동시에 401이 여러 개 떠도 refresh 네트워크 호출은 타입당 1회만 나간다
- **리다이렉트는 API 레이어가 하지 않는다.** 세션 해제만 하고, 이동은 라우트 가드 책임

## 인증 상태 — `@/hooks/common/useAuth`

`user`(일반)와 `admin`(관리자)은 **서로 독립된 세션**이다. 쿠키 접두사가 다르고 동시에 살아있을 수 있다.

```typescript
const { user, admin, isLoading, syncAuth, refreshAuth, setUser, setAdmin } = useAuth();
```

| 항목 | 설명 |
|------|------|
| `user` / `admin` | `{user\|admin}_user_info` 쿠키를 파싱한 `UserInfo \| null` |
| `isLoading` | 최초 쿠키 파싱 완료 전 `true` |
| `syncAuth(type?)` | 쿠키를 다시 읽어 Context에 반영. 파싱 결과를 **동기 반환** |
| `refreshAuth(type?)` | refresh API 호출 후 재동기화. `Promise<UserInfo \| null>`. 같은 type 동시 호출은 하나로 합쳐진다 |
| `setUser` / `setAdmin` | 로그아웃 등에서 상태만 즉시 비울 때 |

**쿠키는 반응형이 아니다.** 서버가 새 쿠키를 내려준 시점(로그인 성공, OAuth 콜백, refresh)에 반드시 `syncAuth()`를 호출해야 화면이 갱신된다.

```typescript
// 로그인 성공 후
loginMutation.mutate(body, {
  onSuccess: () => {
    syncAuth("admin");                        // ✅ 쿠키 → Context 반영
    navigate("/admin", { replace: true });
  },
});
```

**금지 사항**
- `window.location.reload()` / `location.href = <현재 URL>`로 세션을 다시 읽지 말 것. 쿠키가 그대로라 루프가 돈다
- effect 안에서 refresh를 호출할 땐 `useRef` 가드로 마운트당 1회로 제한할 것 (`container/admin/layout.tsx` 참고)
- refresh 시도 전에 `refreshExp(type)`로 세션 마커를 먼저 확인할 것 — 없으면 시도 자체가 무의미하다

## 스타일 — Tailwind

두 계열이 공존한다. **신규 작업은 시맨틱 토큰 우선.**

**시맨틱 토큰** (`index.css`의 CSS 변수 기반, `darkMode: "class"`로 자동 전환)

| 그룹 | 클래스 |
|------|--------|
| 배경 | `bg-bg` `bg-bg-card` `bg-bg-sub` `bg-bg-hover` `bg-bg-active` `bg-bg-disabled` |
| 텍스트 | `text-text-main` `text-text-sub` `text-text-disabled` `text-text-placeholder` `text-text-inverse` |
| 테두리 | `border-line` `border-line-strong` `border-line-focus` |
| 강조 | `bg-primary` `bg-primary-light` `bg-primary-dark` |
| 상태 | `text-success` `bg-success-bg` / `error` `warning` `info` 동일 패턴 |
| 포인트 | `text-point-green` `point-red` `point-amber` `point-blue` — **`bg-point`는 DEFAULT가 없어 존재하지 않는다** |
| 기타 | `bg-overlay` `bg-surface-raised` `bg-skeleton-base` `bg-skeleton-shine` |

**Admin 고정 색상** (다크모드 전환 없음): `main`(#1C1C1C) / `sub1`(#3A3A3A) / `sub2`(#F2F2F2) — 각각 `-hover` `-active` 변형 존재

새 클래스를 쓰기 전에 `tailwind.config.js`에 실제로 있는지 확인할 것. 없는 클래스는 에러 없이 조용히 무시된다.
