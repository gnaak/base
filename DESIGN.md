# DESIGN — base 디자인 시스템

Vercel 콘솔 계열의 절제된 시스템. **깊이를 선이 아니라 1px 링(그림자)으로** 주고,
색은 거의 쓰지 않으며, 타이포그래피의 음수 트래킹으로 밀도를 만든다.

토큰은 `frontend/src/index.css`(CSS 변수)에 있고 `frontend/tailwind.config.js`가
Tailwind 클래스로 노출한다. **색을 직접 쓰지 말고 항상 토큰을 쓴다** — 다크모드가
자동으로 따라오는 유일한 방법이다.

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

### 어드민 고정 색 (다크모드 전환 없음)

`main`(#1C1C1C) / `sub1`(#3A3A3A) / `sub2`(#F2F2F2), 각각 `-hover` `-active` 변형.
**신규 작업에는 쓰지 않는다.** 로그인 배경처럼 테마와 무관하게 고정해야 하는 자리에만 남겨뒀다.

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

`frontend/src/component/admin/` — 참고용이자 출발점이다. 프로젝트에 맞게 고쳐 써도 된다.

| 경로 | 컴포넌트 |
|---|---|
| `ui/form/` | Button · InputBox · SelectBox · ComboBox · TextareaBox · Checkbox · RadioButton · Toggle · Calendar |
| `ui/feedback/` | Modal · FormModal · **ConfirmModal** · Alert · Toast |
| `ui/table/` | Table · TableHeader · TableBody — `Row` 제네릭 |
| `ui/` | **StatCard** · **Skeleton** · Pagination · Loading |
| `layout/` | sideBar(GroupLink·SubLink) · login |

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

// 파괴적 동작 전 확인
<ConfirmModal open={open} variant="warning" title="로그아웃 하시겠습니까?"
              onConfirm={handleLogout} onCancel={() => setOpen(false)} />
```

---

## 6. 레이아웃

- 어드민은 **사이드바 단독** 구성이다 (상단 헤더 없음). 페이지 제목은 각 컨테이너가 그린다
- 본문 폭은 `max-w-6xl mx-auto px-6 py-8`
- 높이는 `h-svh`를 쓴다 — 모바일 주소창이 접히고 펴질 때 `100vh`는 화면 밖으로 삐져나간다
- 사이드바는 `w-60`, `md` 미만에서 숨긴다

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

> ⚠️ 값은 **공백으로 구분한 RGB 숫자**다 (`37 99 235`, `#2563eb` 아님).
> `rgb(var(--primary) / <alpha-value>)` 형태로 쓰기 때문이고, 그래야 `bg-primary/50`이 동작한다.

**없는 클래스는 에러 없이 조용히 무시된다.** 쓰기 전에 `tailwind.config.js`에 실제로 있는지
확인할 것 — 예전에 어드민 레이아웃이 `bg-adminMain`(존재하지 않음)을 쓰고 있어서
배경색이 아예 안 먹고 있었다.
