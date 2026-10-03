# DESIGN — base 디자인 시스템

> **1~7장은 관리자(콘솔) 화면 기준이다.** 고객이 보는 화면은 **정해진 킷(`component/client/ui`)** 을 쓰고
> 톤만 프로젝트마다 다르다 — `/plan` 이 업종 디자인 리서치로 후보를 만들어 `PRD/04_DESIGN.md` 에 테마별 **토큰 값**을 적으면,
> 개발 phase 1 이 고객 레이아웃 최상단의 `.theme-client[data-theme]` 범위에서 토큰(색 · 모양 · 글꼴)을 덮어쓴다.
> 테마 전환은 `data-theme` 값 하나. 킷 · 덮어쓸 수 있는 토큰 목록 · 린트는 [8장 "고객 화면"](#8-고객-화면--componentclientui).

Vercel 콘솔 계열의 절제된 시스템. **깊이를 선이 아니라 1px 링(그림자)으로** 주고,
색은 거의 쓰지 않으며, 타이포그래피의 음수 트래킹으로 밀도를 만든다.

토큰은 `frontend/src/index.css`(CSS 변수)에 있고 `frontend/tailwind.config.js`가
Tailwind 클래스로 노출한다. **색을 직접 쓰지 말고 항상 토큰을 쓴다** — 다크모드가
자동으로 따라오는 유일한 방법이다.

---

## 0. 사람이 정한 취향 — 화면을 만들기 전에 먼저 읽는다

사람이 실제 화면을 보고 정한 것들이다. 아래 장의 일반 규칙과 부딪히면 **이 장이 이긴다**.
부품 기본값으로 담을 수 있는 건 이미 부품에 들어 있다 (쓰기만 하면 된다) — 여기 적힌 건 그 이유와, 부품이 못 막는 배치 · 순서 규칙이다.

**크기 · 입력**
- 작게 — 고객 킷 컨트롤 기본 sm(32px) · 버튼 글자 13px · 입력 글자 14px(손가락 기기만 16px) · 모달 제목 16px. 휴대폰에서 자주 누르는 주요 버튼만 `size="lg"`
- 포커스는 **진한 2px 선**(주 색 — 고른 카드와 같다). 퍼지는 그림자 링은 쓰지 않는다
- 드롭다운은 둥근 목록(`Select`) — 네이티브 `<select>` 를 쓰지 않는다

**표 (관리자 · 고객 공통)**
- **가운데 정렬 — 헤더까지.** 관리자 `Table` 은 `align` 을 안 주면 가운데다. 긴 글(메모 · 주소)과 금액만 `left` · `right`
- **열은 중요한 순서로** — ① 무엇인지(이름 · 번호) → ② 상태 → ③ 핵심 숫자(수량 · 금액) → ④ 날짜(최근 기준) → ⑤ 메모 · 부가 정보 → ⑥ 동작(맨 오른쪽).
  한 표에 꼭 필요한 열만 — 7개 안팎. 나머지는 행을 눌러 여는 상세로
- **페이지네이션은 페이지 맨 아래 15px 에 고정** — `Pagination` 이 항상 그렇게 붙는다. 카드처럼 `relative` 인 상자 안에 넣지 말고 페이지 맨 바깥에 둔다

**관리자 화면 배치**
- **목록 화면은 한 줄에 표 하나.** 표 두 개를 `grid-cols-2` 로 나란히 두지 않는다 — 각각 전체 폭으로 위아래. 여러 칸은 요약 숫자(`StatCard`)만

**모달**
- "~할까요?" 같은 예/아니오는 `ConfirmModal`, 안에 내용(입력 · 선택 · 목록)이 있으면 `Modal`. 본문 없는 `Modal` 은 쓰지 않는다

**이 장을 늘리는 법** — 사람이 화면을 보고 "이렇게" 라고 하면: 부품 기본값으로 바꿀 수 있으면 부품을 고치고(모든 화면이 따라온다),
배치 · 순서처럼 부품이 못 막는 건 여기에 한 줄. 같은 말을 두 번 듣지 않게 한다.

---

## 1. 원칙

1. **선이 아니라 링으로 띄운다.** `border` 대신 `shadow-border`.
   1px 링은 레이아웃 크기를 바꾸지 않아서 hover·focus에서 요소가 밀리지 않는다.
2. **색은 정보일 때만.** 회색조가 기본이고, 색은 상태(성공·경고·위험)나
   단 하나의 강조에만 쓴다. 장식으로 칠하지 않는다.
3. **큰 글자일수록 좁게.** 제목은 음수 트래킹(`tracking-title`·`tracking-heading`)으로
   조인다. 기본값 그대로 두면 한글에서 특히 헐거워 보인다.
4. **숫자는 `tabular-nums`.** 표·지표에서 자릿수가 흔들리면 싸 보인다.
5. **로딩은 스켈레톤으로.** 0을 먼저 그리면 실제 값으로 바뀔 때 숫자가 튄다.

---

## 2. 색

### 시맨틱 토큰 (라이트/다크 자동 전환)

| 그룹 | 클래스 | 용도 |
|---|---|---|
| 배경 | `bg-bg` `bg-bg-card` `bg-bg-sub` `bg-bg-hover` `bg-bg-active` `bg-bg-disabled` | 페이지 / 카드 / 옅은 면 / 상태 |
| 텍스트 | `text-text-main` `text-text-sub` `text-text-disabled` `text-text-placeholder` `text-text-inverse` | 본문 / 보조 / 비활성 |
| 선 | `border-line` `border-line-strong` `border-line-focus` | 구분선 (강조는 `shadow-border` 선호) |
| 강조 | `bg-primary` `bg-primary-light` `bg-primary-dark` | 라이트에서 near-black, 다크에서 near-white |
| 상태 | `text-point-green` `point-red` `point-amber` `point-blue` | 값 자체를 칠할 때 |
| 상태 배경 | `bg-success-bg` `bg-error-bg` `bg-warning-bg` `bg-info-bg` | 아주 옅은 틴트. 뱃지·알림 |
| 입력 | `bg-input-bg` `border-input-border` | 폼 컨트롤 |
| 스켈레톤 | `bg-skeleton-base` `bg-skeleton-shine` | `Skeleton` 컴포넌트가 쓴다 |
| 워크플로 | `text-ship` `text-preview` `text-develop` | Vercel식 배포 단계 색. 선택적 |

> ⚠️ `bg-point`는 없다 — `point`에 DEFAULT를 두지 않았다. `point-red` 같은 하위 키만 쓴다.

### 고정색 — 브랜드 로그인 버튼뿐

| 클래스 | 용도 |
|---|---|
| `bg-kakao` `hover:bg-kakao-hover` `text-kakao-text` | 카카오 로그인 버튼 (카카오 가이드 색) |
| `bg-google` `hover:bg-google-hover` `border-google-border` `text-google-text` | 구글 로그인 버튼 (구글 가이드 색) |

이 둘 말고는 고정색을 쓰지 않는다 — `bg-white`·`gray-*`·`[#hex]` 는 다크모드·고객 화면 테마가 닿지 않는다.
예전의 `main`/`sub1`/`sub2` 는 지웠다 (관리자 컴포넌트 14개에 고정색이 박혀 다크모드가 안 먹던 원인이다).
흰 글자는 `text-text-inverse` — 다크모드에서 `primary` 가 거의 흰색이 된다.

---

## 3. 타이포그래피

```
sans: Geist → Pretendard → system
mono: Geist Mono → ui-monospace
```

폰트는 `frontend/public/fonts/`에 있고 `index.css`의 `@font-face`가 가변 폰트로 로드한다.
Pretendard는 CDN에서 받아 한글을 맡는다.

| 클래스 | 값 | 쓰는 곳 |
|---|---|---|
| `tracking-display` | −0.06em | 초대형 제목 (48px+) |
| `tracking-heading` | −0.04em | 섹션 제목 (32px) |
| `tracking-title` | −0.04em | 페이지 제목 (24px) |
| `tracking-tight` | −0.02em | 본문·라벨 (16px) |

**크기는 임의값(`text-[13px]`)을 쓴다.** Tailwind 기본 스케일(14/16/18)은 이 밀도에
비해 성겨서, 어드민 화면은 11·12·13·15·18·22px 위주로 쓴다.

모노스페이스는 **식별자에만** — 워드마크(`base · admin`), 코드, 파일 경로.

---

## 4. 모양

### radius

| 클래스 | 값 | 쓰는 곳 |
|---|---|---|
| `rounded-micro` | 2px | 아주 작은 뱃지 |
| `rounded-subtle` | 4px | 뱃지·칩 |
| `rounded` | 6px | 기본 (버튼·입력) |
| `rounded-comfy` | 8px | 카드·패널 |
| `rounded-image` | 12px | 이미지·썸네일 |
| `rounded-tab` / `rounded-nav-pill` | 64px / 100px | 탭·필 |

위는 고정값(관리자용)이다. **고객 화면 킷은 아래 모양 토큰만 쓴다** — 값이 `index.css` 의 CSS 변수라 테마가 모양을 바꿀 수 있다.
기본값은 지금 화면 그대로라 테마가 없으면 아무것도 안 바뀐다.

| 클래스 | 변수 | 기본값 | 쓰는 곳 |
|---|---|---|---|
| `rounded-control` | `--radius-control` | 8px (관리자 버튼의 `rounded-lg`) | 버튼 · 입력칸 · 뱃지 · 체크박스(절반) |
| `rounded-card` | `--radius-card` | 12px | 카드 · 목록 묶음 · 토스트 |
| `rounded-sheet` | `--radius-sheet` | 16px | 모달 · 바텀시트 윗모서리 |
| `h-control-sm` · `min-h-` · `w-` · `min-w-` | `--control-h-sm` | 32px | **기본** — 버튼 · 입력칸 · 아이콘 버튼 · 선택 · 체크 · 토글 · 뱃지 (size 를 안 적으면 sm) |
| `h-control-md` · … | `--control-h-md` | 38px | 조금 큰 버튼 · 입력칸 |
| `h-control-lg` · … | `--control-h-lg` | 44px — **손가락 터치 권장** | 휴대폰에서 자주 누르는 주요 버튼(결제 등) · 목록 한 줄 |
| `font-client` | `--font-client` | Geist → Pretendard (`font-sans` 와 같다) | 고객 화면 전체 (`.theme-client` 아래는 자동) |

### 그림자

| 클래스 | 용도 |
|---|---|
| `shadow-border` | **시그니처.** 1px 링. 라이트/다크 자동 전환 |
| `shadow-subtle` | 살짝 떠 있는 느낌 |
| `shadow-card` | 다층 카드 스택 (링 + 근접 + 원거리) |
| `shadow-focus` | 포커스 링 (2px 배경색 + 2px 파랑) |

```tsx
// ✅ 링으로 띄운다 — 크기가 안 변해서 hover 에 요소가 밀리지 않는다
<div className="rounded-comfy bg-bg-card shadow-border px-4 py-3.5">

// ❌ border 는 레이아웃 크기를 먹는다
<div className="rounded-comfy bg-bg-card border border-line px-4 py-3.5">
```

### 모션

`animate-fade-slide`(150ms) · `animate-shimmer`(스켈레톤) ·
`animate-drawer-in`(180ms) · `animate-fade-in` · `animate-caret`.

**150~180ms를 넘기지 않는다.** 어드민 도구에서 긴 애니메이션은 느리게 느껴진다.

---

## 5. 컴포넌트

`frontend/src/component/admin/` — 관리자 화면용. 참고용이자 출발점이다. 프로젝트에 맞게 고쳐 써도 된다.
고객 화면은 이걸 쓰지 않고 `component/client/ui` 를 쓴다 (8장) — prop 이름이 같아서 쓰는 법은 하나다.

| 경로 | 컴포넌트 |
|---|---|
| `ui/form/` | Button · InputBox · SelectBox · ComboBox · TextareaBox · Checkbox · RadioButton · Toggle · Calendar |
| `ui/feedback/` | Modal · FormModal · **ConfirmModal** · Alert · Toast |
| `ui/table/` | Table · TableHeader · TableBody — `Row` 제네릭 |
| `ui/` | **StatCard** · **Skeleton** · Pagination · Loading |
| `layout/` | sideBar(GroupLink·SubLink) · login |
| `component/common/` | **ThemeToggle**(라이트/다크) · ErrorBoundary — 관리자·고객 화면이 같이 쓴다 |

### 자주 쓰는 셋

```tsx
// 지표 — loading 이면 같은 높이의 스켈레톤이 자리를 잡는다
<StatCard icon={<Users className="w-3.5 h-3.5" />} label="전체 사용자"
          value={<span className="tabular-nums">1,284</span>}
          note="지난 7일 +42" loading={isLoading} large />

// 표 — Row 제네릭이라 render 의 인자에도 타입이 붙는다
const columns: Column<UserRow>[] = [
  { key: "name", header: "이름" },
  { key: "plan", header: "플랜", align: "center", render: (row) => <Badge plan={row.plan} /> },
];
<Table columns={columns} data={rows} loading={isLoading} />

// 파괴적 동작 전 확인 — 가운데 아이콘 → 제목 → 설명, 버튼은 반반. 아이콘은 variant 기본값 대신 바꿔 끼울 수 있다
<ConfirmModal open={open} variant="danger" icon={<LogOut />} title="로그아웃 하시겠습니까?"
              onConfirm={handleLogout} onCancel={() => setOpen(false)} />
```

---

## 6. 레이아웃

- 어드민은 **사이드바 + 얇은 상단 바(`h-14`)** 구성이다. 상단 바 우측에는 라이트/다크 토글이 있고, 페이지 제목은 각 컨테이너가 그린다
- 본문 폭은 `max-w-6xl mx-auto px-6 py-8`
- 높이는 `h-svh`를 쓴다 — 모바일 주소창이 접히고 펴질 때 `100vh`는 화면 밖으로 삐져나간다
- 사이드바는 `w-60`. **md 미만에서는 숨는 대신 상단 바 왼쪽의 메뉴 버튼이 같은 사이드바를 드로어로 연다**
  (`container/admin/layout.tsx`). 경로가 바뀌거나 ESC·바깥을 누르면 닫힌다 — 사장님이 휴대폰으로 열어도 이동할 수 있게
- 다크모드는 `ThemeProvider`(`src/context/ThemeProvider.tsx`)가 `<html>` 에 `.dark` 를 붙여 켠다. 처음엔 OS 설정을 따르고,
  `ThemeToggle`(`component/common/themeToggle.tsx`, 라이트·다크 두 칸)로 고르면 localStorage `theme` 에 남는다.
  관리자 상단 바와 고객 첫 화면 헤더가 같은 토글을 쓴다. 첫 페인트는 `index.html` 의 인라인 스크립트가 맡는다
- 텍스트 선택을 막지 않는다 (전역 `user-select: none` 없음 — 버튼만 막는다). 판매자 정보·약관·표의 값은 복사돼야 한다
- 한글 줄바꿈은 띄어쓰기에서 (`body` 의 `word-break: keep-all`). 음절에서 끊기면 "있습니 / 다" 처럼 한 글자가 다음 줄로 떨어진다

---

## 7. 바꿀 때

새 프로젝트에서 색감을 바꾸려면 **`index.css`의 CSS 변수만** 고친다.
`tailwind.config.js`는 그 변수를 가리킬 뿐이라 건드릴 일이 거의 없다.

```css
:root {
  --primary: 37 99 235;   /* 예: 파란 브랜드로 */
}
.dark { --primary: 96 165 250; }
```

**고객 화면만 바꿀 때**는 `:root` 가 아니라 범위 클래스에 쓴다 — `:root` 를 바꾸면 관리자 화면까지 바뀐다.

```css
/* 고객 레이아웃 최상단 요소: <div class="theme-client" data-theme="a"> */
.theme-client[data-theme="a"]       { --primary: 194 65 12; }
.dark .theme-client[data-theme="a"] { --primary: 251 146 60; }  /* 없으면 다크모드에서도 라이트 값이 나온다 */
```

> ⚠️ 테마가 여럿이면 **모든 테마가 같은 변수를 라이트·다크 둘 다** 정의하고, 기본 테마도 `[data-theme]` 를 붙여 쓴다.
> - 다크 값이 빠진 변수는 그 요소에 선언된 라이트 값이 `<html class="dark">` 에서 물려받는 값을 이겨서, 다크모드에서도 라이트로 나온다
> - 기본 테마를 `[data-theme]` 없는 `.dark .theme-client` 로 쓰면 다른 테마의 `.theme-client[data-theme="b"]` 와
>   우선순위가 같아져, 작성 순서에 따라 테마끼리 값이 섞인다

> ⚠️ 값은 **공백으로 구분한 RGB 숫자**다 (`37 99 235`, `#2563eb` 아님).
> `rgb(var(--primary) / <alpha-value>)` 형태로 쓰기 때문이고, 그래야 `bg-primary/50`이 동작한다.

**없는 클래스는 에러 없이 조용히 무시된다.** 쓰기 전에 `tailwind.config.js`에 실제로 있는지
확인할 것 — 예전에 어드민 레이아웃이 `bg-adminMain`(존재하지 않음)을 쓰고 있어서
배경색이 아예 안 먹고 있었다.

---

## 8. 고객 화면 — `component/client/ui`

고객 화면의 컴포넌트는 **정해져 있다.** 프로젝트마다 다른 건 토큰 값(테마)뿐이고, 컴포넌트를 새로 지어내지 않는다 —
그래야 phase 를 몇 번 돌아도 버튼 · 입력칸 · 시트가 한 모양으로 남는다. API 는 관리자 킷(5장)과 같은 이름이다
(`variant="main"|"sub1"|"sub2"|"danger"` · `size` · `leftIcon` · `rightIcon` · `full` · `value`/`onChange(값)` …).

### 규칙 — 고객 화면은 이 킷만 쓴다 (린트)

- `src/container/client/**` · `src/component/client/**` 에서 날 `<button>` `<input>` `<select>` `<textarea>` 는
  **`npm run lint` 에러**다 (`eslint.config.js` 의 `CLIENT_KIT_RULES`). 날 태그는 킷(`component/client/ui/` · `layout/`) 안에만 있다
- 킷에 없는 컨트롤이 필요하면 페이지에 그리지 말고 `component/client/ui/` 에 추가한다 — 그때도 토큰 클래스만
  (`rounded-control` · `h-control-*` · `bg-bg-card` …). 한 페이지 전용 조합(예: `planCard`)은 킷 컴포넌트를 묶어 `component/client/{페이지}/` 에
- 범위 밖: 소셜 로그인 버튼(`hooks/auth/` — 각 사 가이드 색) · `ThemeToggle`(`component/common/` — 관리자와 같이 쓴다)
- 눈으로 확인: 개발 서버의 **`/dev/ui`** — 모든 컴포넌트·상태 + 데모 테마 셋(기본 · 둥글고 따뜻한 · 각지고 단단한) + 라이트/다크.
  "프로젝트 테마" 칸에 `data-theme` 이름을 넣으면 `index.css` 의 실제 테마로 본다. 운영 빌드에는 없다 (`import.meta.env.DEV`)

### 컴포넌트

| 경로 | 컴포넌트 | 관리자 짝 · 메모 |
|---|---|---|
| `ui/button.tsx` | **Button** — main · sub1(흰 면+링) · sub2(옅은 회색) · danger · ghost / `loading` | Button. `type` 기본 "button". ghost · loading 은 고객에만 |
| `ui/iconButton.tsx` | **IconButton** — 글자 없는 버튼, `label` 필수(aria-label) | — (뒤로 · 닫기 · 장바구니) |
| `ui/textField.tsx` · `textArea.tsx` | **TextField** · **TextArea** — label · hint · error · required, aria 연결 | InputBox · TextareaBox. 글자 14px · 손가락 기기만 16px(iOS 확대 방지) · 포커스는 테두리 색만 |
| `ui/select.tsx` | **Select** — 직접 그린 둥근 목록 (combobox + listbox · 키보드 · Esc 는 목록만 닫음 · 포커스는 진한 2px 선) | SelectBox 와 같은 방식. 목록은 body 로 portal 해서 모달 안에서도 안 잘린다 · 아래가 좁으면 위로 펼친다 |
| `ui/checkbox.tsx` · `toggle.tsx` · `radioGroup.tsx` | **Checkbox** · **Toggle**(`role="switch"`) · **RadioGroup**(카드형 선택) | Checkbox · Toggle · RadioButton |
| `ui/card.tsx` · `badge.tsx` · `listRow.tsx` | **Card**(flat · raised) · **Badge**(neutral · success · warning · error · info) · **ListRow**(`to` → 링크, `onClick` → 버튼) | — |
| `ui/emptyState.tsx` · `skeleton.tsx` · `spinner.tsx` | **EmptyState** · **Skeleton** · Spinner | Skeleton · Loading |
| `ui/modal.tsx` · `confirmModal.tsx` · `toast.tsx` | **Modal**(모바일 바텀시트 · sm 이상 가운데) · **ConfirmModal** · **Toast** | Modal · ConfirmModal · Toast 와 같은 API (+ children · loading) |
| `layout/clientHeader.tsx` · `bottomTab.tsx` · `pageContainer.tsx` | **ClientHeader**(뒤로 · 제목 · 오른쪽) · **BottomTab**(NavLink, safe-area) · **PageContainer**(최대 폭 · 여백) | — |

**Modal 과 ConfirmModal 을 가르는 기준** — "~할까요?" 같은 예/아니오 질문은 **ConfirmModal**(아이콘 · 제목 · 버튼 둘). 안에 **내용**(입력 · 선택 · 목록)이 있으면 **Modal**. 본문 없는 Modal 은 ConfirmModal 과 같아 보이니 쓰지 않는다.

킷 내부용: `dialogShell.tsx`(모달 껍데기 — ESC · 스크롤 잠금 · 포커스) · `themePortal.tsx` · `field.tsx` · `fieldStyle.ts`.

```tsx
<PageContainer bottomTab>
  <TextField label="받는 분" required value={name} onChange={setName} error={nameError} />
  <Card padding="none" className="divide-y divide-line">
    <ListRow leading={<Receipt />} title="주문 내역" to="/orders" />
    <ListRow title="푸시 알림" trailing={<Toggle aria-label="푸시 알림" checked={push} onChange={setPush} />} />
  </Card>
  <Button full size="lg" loading={paying} onClick={handlePay}>24,000원 결제하기</Button>
</PageContainer>
<BottomTab items={[{ label: "홈", to: "/", icon: Home }, { label: "주문", to: "/orders", icon: Receipt }]} />
```

### 테마가 덮어쓸 수 있는 토큰 — 이 목록만

`.theme-client[data-theme="x"]`(라이트) · `.dark .theme-client[data-theme="x"]`(다크) 에서 **아래 변수만** 덮어쓴다.
컴포넌트 · 클래스는 손대지 않는다.

| 묶음 | 변수 | 라이트·다크 |
|---|---|---|
| 강조 | `--primary` `--primary-light` `--primary-dark` | 둘 다 |
| 배경 | `--bg` `--bg-card` `--bg-sub` `--bg-hover` `--bg-active` `--bg-disabled` | 둘 다 |
| 글자 | `--text-main` `--text-sub` `--text-disabled` `--text-placeholder` `--text-inverse` | 둘 다 |
| 선 | `--border` `--border-strong` `--border-focus` `--shadow-border` | 둘 다 |
| 입력 | `--input-bg` `--input-border` | 둘 다 |
| 상태 | `--point-green` `--point-red` `--point-amber` `--point-blue` `--success-bg` `--error-bg` `--warning-bg` `--info-bg` | 둘 다 — 바꾸면 흰 배경·흰 글자 대비 4.5:1 을 다시 확인 |
| 면 | `--overlay` `--surface-raised` `--skeleton-base` `--skeleton-shine` | 둘 다 |
| **모양** | `--radius-control` `--radius-card` `--radius-sheet` `--control-h-sm` `--control-h-md` `--control-h-lg` | 라이트 규칙에 한 번 — 다크 규칙이 안 덮으니 그대로 간다 |
| **글꼴** | `--font-client` | 라이트 규칙에 한 번 (웹폰트 로딩은 phase 1 이 `index.html`·`index.css` 에) |

- 덮어쓰지 않는 것: `--ship` `--preview` `--develop`(관리자 워크플로 색 — 킷이 안 쓴다), 고정 radius 클래스(`rounded-comfy` 등 — 관리자용),
  브랜드 로그인 색(`kakao` · `google`)
- 휴대폰에서 자주 누르는 주요 버튼은 `size="lg"`(`--control-h-lg` 44px — 터치 권장). 기본은 sm(32px). 모양 값은 공백 RGB 가 아니라 그대로 CSS 길이(`14px`)다
- 색 변수는 위 7장의 ⚠️ 그대로 — 테마마다 라이트·다크 둘 다, 기본 테마도 `[data-theme]` 를 붙인다

### 알아 둘 것

- **글꼴** — `index.css` 의 전역 `*` 가 요소마다 글꼴을 박아서 부모 글꼴이 상속되지 않는다. 그래서
  `:where(.theme-client, .theme-client *)` 가 `--font-client` 로 다시 잡는다 (code · `font-mono` 는 그대로)
- **모달 · 토스트는 `document.body` 로 portal 한다** (sticky · transform 부모에 갇히지 않게). body 는 `.theme-client` 밖이라
  `themePortal.tsx` 가 가장 가까운 `.theme-client` 의 `data-theme` 과 인라인 `--*` 변수를 portal 감싸개로 옮긴다 —
  **테마는 `.theme-client` 요소 자체에 건다** (중간 요소에 변수를 두면 모달에 안 따라간다)
- 글자색 · 배경은 `.theme-client` 요소에서 다시 잡는다(`bg-bg text-text-main`) — body 의 값은 `:root` 토큰으로 계산돼 내려온다
- safe-area(노치 · 홈 인디케이터)는 body 가 네 방향 모두 비운다. 화면에 붙는 것(BottomTab · 시트 · 토스트 · sticky 헤더)만 따로 비운다
