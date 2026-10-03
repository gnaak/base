import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CreditCard,
  Home,
  Inbox,
  Mail,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  User,
} from "lucide-react";

import { useTheme } from "@/hooks/common/useTheme";
import ThemeToggle from "@/component/common/themeToggle";
import Badge from "@/component/client/ui/badge";
import Button from "@/component/client/ui/button";
import Card from "@/component/client/ui/card";
import Checkbox from "@/component/client/ui/checkbox";
import ConfirmModal from "@/component/client/ui/confirmModal";
import EmptyState from "@/component/client/ui/emptyState";
import IconButton from "@/component/client/ui/iconButton";
import ListRow from "@/component/client/ui/listRow";
import Modal from "@/component/client/ui/modal";
import RadioGroup from "@/component/client/ui/radioGroup";
import Select from "@/component/client/ui/select";
import Skeleton from "@/component/client/ui/skeleton";
import TextArea from "@/component/client/ui/textArea";
import TextField from "@/component/client/ui/textField";
import Toast from "@/component/client/ui/toast";
import Toggle from "@/component/client/ui/toggle";
import BottomTab, { type BottomTabItem } from "@/component/client/layout/bottomTab";
import ClientHeader from "@/component/client/layout/clientHeader";
import PageContainer from "@/component/client/layout/pageContainer";

/**
 * 고객 화면 UI 킷 미리보기 — **개발 서버에서만** 열린다 (`/dev/ui`, App.tsx 가 import.meta.env.DEV 일 때만 등록).
 *
 * 데모 테마 셋은 `.theme-client` 감싸개에 CSS 변수를 인라인으로 넣어 만든다 — 색·모양·글꼴 토큰만 바꿔도
 * 같은 컴포넌트가 다른 서비스처럼 보이는지 확인하는 용도다. 실제 프로젝트 테마는 index.css 의
 * `.theme-client[data-theme="x"]` 에 두고, 아래 "프로젝트 테마" 칸에 그 이름을 넣어 확인한다.
 */

type Vars = Record<string, string>;
type DemoTheme = { label: string; desc: string; light: Vars; dark: Vars };

const DEMO_THEMES: Record<"base" | "warm" | "solid", DemoTheme> = {
  base: { label: "기본", desc: "토큰 기본값 — 관리자 화면과 같은 모양", light: {}, dark: {} },
  warm: {
    label: "둥글고 따뜻한",
    desc: "주황 · 크림 배경 · 큰 모서리 · 높은 버튼 · Pretendard",
    light: {
      "--primary": "194 65 12",
      "--primary-dark": "154 52 18",
      "--bg": "255 250 245",
      "--bg-card": "255 255 255",
      "--bg-sub": "253 243 233",
      "--bg-hover": "250 238 226",
      "--bg-active": "245 226 208",
      "--text-main": "41 28 20",
      "--text-sub": "107 84 70",
      "--border": "240 226 214",
      "--border-strong": "222 200 182",
      "--input-bg": "255 255 255",
      "--input-border": "236 220 206",
      "--shadow-border": "rgba(120, 60, 20, 0.12) 0px 0px 0px 1px",
      "--radius-control": "14px",
      "--radius-card": "20px",
      "--radius-sheet": "28px",
      "--control-h-sm": "38px",
      "--control-h-md": "48px",
      "--control-h-lg": "56px",
      "--font-client": '"Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif',
    },
    dark: {
      "--primary": "251 146 60",
      "--primary-dark": "253 186 116",
      "--bg": "28 22 18",
      "--bg-card": "40 31 25",
      "--bg-sub": "48 38 31",
      "--bg-hover": "58 46 38",
      "--bg-active": "72 58 48",
      "--text-main": "245 236 228",
      "--text-sub": "196 178 164",
      "--border": "66 53 44",
      "--border-strong": "92 76 64",
      "--input-bg": "40 31 25",
      "--input-border": "66 53 44",
      "--shadow-border": "rgba(255, 220, 190, 0.1) 0px 0px 0px 1px",
      "--radius-control": "14px",
      "--radius-card": "20px",
      "--radius-sheet": "28px",
      "--control-h-sm": "38px",
      "--control-h-md": "48px",
      "--control-h-lg": "56px",
      "--font-client": '"Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif',
    },
  },
  solid: {
    label: "각지고 단단한",
    desc: "남색 · 진한 테두리 · 거의 직각 · 고정폭 숫자 글꼴",
    light: {
      "--primary": "30 58 138",
      "--primary-dark": "23 37 84",
      "--bg": "247 248 250",
      "--bg-card": "255 255 255",
      "--bg-sub": "241 243 246",
      "--bg-hover": "236 239 243",
      "--bg-active": "226 230 236",
      "--text-main": "15 23 42",
      "--text-sub": "71 85 105",
      "--border": "214 219 226",
      "--border-strong": "176 184 196",
      "--input-bg": "255 255 255",
      "--input-border": "190 198 210",
      "--shadow-border": "rgba(15, 23, 42, 0.2) 0px 0px 0px 1px",
      "--radius-control": "2px",
      "--radius-card": "4px",
      "--radius-sheet": "6px",
      "--control-h-sm": "36px",
      "--control-h-md": "46px",
      "--control-h-lg": "54px",
      "--font-client": '"Geist Mono", "Pretendard", ui-monospace, monospace',
    },
    dark: {
      "--primary": "147 197 253",
      "--primary-dark": "191 219 254",
      "--bg": "12 16 24",
      "--bg-card": "20 26 36",
      "--bg-sub": "28 35 48",
      "--bg-hover": "36 44 58",
      "--bg-active": "48 58 74",
      "--text-main": "226 232 240",
      "--text-sub": "148 163 184",
      "--border": "44 54 70",
      "--border-strong": "71 85 105",
      "--input-bg": "20 26 36",
      "--input-border": "52 64 82",
      "--shadow-border": "rgba(148, 163, 184, 0.24) 0px 0px 0px 1px",
      "--radius-control": "2px",
      "--radius-card": "4px",
      "--radius-sheet": "6px",
      "--control-h-sm": "36px",
      "--control-h-md": "46px",
      "--control-h-lg": "54px",
      "--font-client": '"Geist Mono", "Pretendard", ui-monospace, monospace',
    },
  },
};

type ThemeKey = keyof typeof DEMO_THEMES;

const TABS: BottomTabItem[] = [
  { label: "홈", to: "/dev/ui", icon: Home, end: true },
  { label: "검색", to: "/dev/ui/search", icon: Search },
  { label: "주문", to: "/dev/ui/orders", icon: Receipt },
  { label: "내 정보", to: "/dev/ui/me", icon: User },
];

const PICKUP_OPTIONS = [
  { value: "delivery", label: "배달", description: "40~50분 · 배달팁 3,000원", trailing: "+3,000원" },
  { value: "pickup", label: "포장", description: "15분 뒤 매장에서 받기", trailing: "−2,000원" },
  { value: "dine", label: "매장 식사", description: "지금은 준비 중이에요", disabled: true },
];

const CATEGORY_OPTIONS = [
  { label: "한식", value: "korean" },
  { label: "분식", value: "snack" },
  { label: "카페 · 디저트", value: "cafe" },
  { label: "품절된 항목", value: "soldout", disabled: true },
];

type ToastKind = "info" | "success" | "warning" | "error";
const ENTRY_OPTIONS = [
  { label: "공동현관 비밀번호 있음", value: "code" },
  { label: "경비실 호출", value: "guard" },
  { label: "자유 출입", value: "free" },
];

const TOAST_COPY: Record<ToastKind, { title: string; description?: string }> = {
  info: { title: "새 쿠폰이 도착했어요" },
  success: { title: "주문이 접수됐어요", description: "사장님이 확인하면 알림으로 알려 드릴게요." },
  warning: { title: "배달 지연 안내", description: "주문이 많아 10분 정도 더 걸려요." },
  error: { title: "결제에 실패했어요", description: "카드 한도를 확인한 뒤 다시 시도해 주세요." },
};

const Section = ({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3">
    <div>
      <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
      {desc && <p className="mt-0.5 text-[13px] text-text-sub">{desc}</p>}
    </div>
    <Card padding="lg" className="flex flex-col gap-6">
      {children}
    </Card>
  </section>
);

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <span className="text-[12px] font-medium text-text-sub">{label}</span>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

const UiPreview = () => {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const [themeKey, setThemeKey] = useState<ThemeKey>("base");
  const [projectTheme, setProjectTheme] = useState("");

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("010-12");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState<string | number | null>(null);
  const [agree, setAgree] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [push, setPush] = useState(true);
  const [pickup, setPickup] = useState<string | number>("delivery");

  const [modalOpen, setModalOpen] = useState(false);
  const [entry, setEntry] = useState<string | number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirm, setConfirm] = useState<"default" | "warning" | "danger" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastKind | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const theme = DEMO_THEMES[themeKey];
  const vars = (resolved === "dark" ? theme.dark : theme.light) as CSSProperties;
  // 기본 테마일 때만 "프로젝트 테마" 이름을 data-theme 으로 건다 (index.css 의 실제 테마 확인용)
  const dataTheme = themeKey === "base" && projectTheme.trim() ? projectTheme.trim() : undefined;

  const handleFakeSave = () => {
    setSaving(true);
    window.setTimeout(() => setSaving(false), 1500);
  };

  const handleDelete = () => {
    setDeleting(true);
    window.setTimeout(() => {
      setDeleting(false);
      setConfirm(null);
      setToast("success");
    }, 1200);
  };

  const phoneError = phone && !/^010-\d{4}-\d{4}$/.test(phone) ? "010-0000-0000 형식으로 입력해 주세요" : undefined;

  return (
    <div className="theme-client min-h-svh bg-bg text-text-main" data-theme={dataTheme} style={vars}>
      <ClientHeader
        title="UI 킷 미리보기"
        left={<span className="px-2.5 font-mono text-[13px] font-semibold tracking-tight">base · dev</span>}
        right={<ThemeToggle />}
      />

      <PageContainer size="lg" className="flex flex-col gap-10 pt-6">
        {/* 테마 */}
        <section className="flex flex-col gap-3">
          <p className="text-[14px] leading-relaxed text-text-sub">
            고객 화면 킷(<code>component/client/ui</code> · <code>layout</code>)의 모든 컴포넌트와 상태. 아래 테마는 같은 컴포넌트에
            토큰(색 · <code>--radius-*</code> · <code>--control-h-*</code> · <code>--font-client</code>)만 바꿔 넣은 것이다. 라이트/다크는 오른쪽 위.
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="데모 테마">
            {(Object.keys(DEMO_THEMES) as ThemeKey[]).map((key) => (
              <Button
                key={key}
                size="sm"
                variant={themeKey === key ? "main" : "sub1"}
                aria-pressed={themeKey === key}
                onClick={() => setThemeKey(key)}
              >
                {DEMO_THEMES[key].label}
              </Button>
            ))}
          </div>
          <p className="text-[13px] text-text-sub">{theme.desc}</p>
          <TextField
            size="sm"
            label="프로젝트 테마 (data-theme)"
            hint='phase 1 이 index.css 에 만든 테마 이름 (예: a). "기본" 을 고른 상태에서만 걸린다'
            placeholder="비우면 토큰 기본값"
            value={projectTheme}
            onChange={setProjectTheme}
            className="max-w-sm"
          />
        </section>

        <Section title="버튼" desc="Button — variant · size · 아이콘 · disabled · loading / IconButton">
          <Row label="variant (md)">
            <Button variant="main">주문하기</Button>
            <Button variant="sub1">장바구니</Button>
            <Button variant="sub2">나중에</Button>
            <Button variant="danger">삭제</Button>
            <Button variant="ghost">건너뛰기</Button>
          </Row>
          <Row label="size">
            <Button size="sm">작게 sm</Button>
            <Button size="md">보통 md</Button>
            <Button size="lg">크게 lg</Button>
          </Row>
          <Row label="아이콘">
            <Button leftIcon={<Plus />}>담기</Button>
            <Button variant="sub1" rightIcon={<ArrowRight />}>
              다음
            </Button>
            <Button variant="sub2" size="sm" leftIcon={<ShoppingBag />}>
              3개
            </Button>
          </Row>
          <Row label="disabled">
            <Button disabled>주문하기</Button>
            <Button variant="sub1" disabled>
              장바구니
            </Button>
            <Button variant="sub2" disabled>
              나중에
            </Button>
            <Button variant="danger" disabled>
              삭제
            </Button>
          </Row>
          <Row label="loading (눌러 보기)">
            <Button loading={saving} onClick={handleFakeSave}>
              저장
            </Button>
            <Button variant="sub1" loading>
              불러오는 중
            </Button>
          </Row>
          <Row label="full">
            <Button full loading={saving} onClick={handleFakeSave}>
              24,000원 결제하기
            </Button>
          </Row>
          <Row label="IconButton — ghost · sub1 · sub2 · main / sm · md · lg">
            <IconButton icon={<Bell />} label="알림" />
            <IconButton icon={<Search />} label="검색" variant="sub1" />
            <IconButton icon={<ShoppingBag />} label="장바구니" variant="sub2" />
            <IconButton icon={<Plus />} label="추가" variant="main" />
            <IconButton icon={<Bell />} label="알림 작게" size="sm" variant="sub1" />
            <IconButton icon={<Bell />} label="알림 크게" size="lg" variant="sub1" />
            <IconButton icon={<Trash2 />} label="삭제 (비활성)" variant="sub1" disabled />
          </Row>
        </Section>

        <Section title="입력" desc="TextField · TextArea · Select · Checkbox · Toggle · RadioGroup — 라벨·도움말·오류가 aria 로 연결된다">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="받는 분" required placeholder="이름" hint="주문서에만 쓰여요" value={name} onChange={setName} autoComplete="name" />
            <TextField
              label="휴대폰 번호"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={setPhone}
              error={phoneError}
              hint="배달 출발 알림을 보내 드려요"
            />
            <TextField label="검색" type="search" placeholder="메뉴 · 가게 이름" leftIcon={<Search />} />
            <TextField label="이메일" type="email" placeholder="me@example.com" rightIcon={<Mail />} />
            <TextField label="쿠폰 코드" placeholder="사용할 수 없어요" disabled />
            <TextField label="sm 크기" size="sm" placeholder="h-control-sm" />
          </div>
          <TextArea
            label="요청 사항"
            placeholder="문 앞에 두고 벨 눌러 주세요"
            value={memo}
            onChange={setMemo}
            maxLength={200}
            showCount
          />
          <div className="grid gap-5 md:grid-cols-2">
            <Select label="카테고리" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} hint="네이티브 선택 — 휴대폰은 OS 시트가 뜬다" />
            <Select label="필수 선택" required options={CATEGORY_OPTIONS} value={null} error="카테고리를 골라 주세요" />
          </div>
          <Row label="Checkbox — sm · md · lg · disabled">
            <Checkbox size="sm" label="작게" defaultChecked />
            <Checkbox label="(필수) 이용약관 동의" checked={agree} onChange={setAgree} />
            <Checkbox size="lg" label="(선택) 마케팅 수신" checked={marketing} onChange={setMarketing} />
            <Checkbox label="비활성" disabled />
            <Checkbox label="비활성 체크" disabled checked />
          </Row>
          <Row label="Toggle — sm · md · lg · disabled (role=switch)">
            <Toggle size="sm" aria-label="작은 스위치" defaultChecked />
            <Toggle aria-label="푸시 알림" checked={push} onChange={setPush} />
            <Toggle size="lg" aria-label="큰 스위치" />
            <Toggle aria-label="비활성 스위치" disabled />
            <Toggle aria-label="비활성 켜짐" disabled checked />
          </Row>
          <RadioGroup label="받는 방법" options={PICKUP_OPTIONS} value={pickup} onChange={setPickup} hint="카드형 단일 선택 — 고른 카드는 주 색 링" />
        </Section>

        <Section title="표시" desc="Badge · Card · ListRow · EmptyState · Skeleton">
          <Row label="Badge — tone · size">
            <Badge>기본</Badge>
            <Badge tone="success">결제 완료</Badge>
            <Badge tone="warning">배달 지연</Badge>
            <Badge tone="error">주문 취소</Badge>
            <Badge tone="info">새 소식</Badge>
            <Badge tone="success" size="sm">
              sm
            </Badge>
            <Badge tone="info" icon={<Package />}>
              아이콘
            </Badge>
          </Row>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <p className="text-[15px] font-semibold">Card — flat</p>
              <p className="mt-1 text-[13px] text-text-sub">흰 면 + 1px 링, rounded-card</p>
            </Card>
            <Card variant="raised">
              <p className="text-[15px] font-semibold">Card — raised</p>
              <p className="mt-1 text-[13px] text-text-sub">화면의 주인공 하나에만</p>
            </Card>
          </div>
          <Card padding="none" className="divide-y divide-line">
            <ListRow leading={<Receipt />} title="주문 내역" sub="최근 3개월" to="/dev/ui/orders" />
            <ListRow leading={<CreditCard />} title="결제 수단" trailing={<Badge tone="success">등록됨</Badge>} onClick={() => setToast("info")} />
            <ListRow leading={<Bell />} title="푸시 알림" sub="주문 상태 · 쿠폰" trailing={<Toggle aria-label="푸시 알림 받기" checked={push} onChange={setPush} />} />
            <ListRow leading={<Package />} title="배송지 관리" sub="준비 중이에요" onClick={() => {}} disabled />
            <ListRow title="앱 버전" trailing="1.0.0" />
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card padding="none">
              {showEmpty ? (
                <EmptyState
                  icon={<Inbox />}
                  title="아직 주문이 없어요"
                  description="마음에 드는 가게를 찾아 첫 주문을 해 보세요."
                  action={
                    <Button size="sm" onClick={() => setShowEmpty(false)}>
                      가게 둘러보기
                    </Button>
                  }
                />
              ) : (
                <div className="flex flex-col gap-4 p-5" aria-label="불러오는 중">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-11 h-11 rounded-full" />
                      <div className="flex-1 flex flex-col gap-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="sub2" onClick={() => setShowEmpty(true)}>
                    불러오기 끝 → 빈 상태 보기
                  </Button>
                </div>
              )}
            </Card>
            <Card padding="none">
              <EmptyState icon={<Search />} title="검색 결과가 없어요" description="철자를 확인하거나 다른 이름으로 찾아보세요." />
            </Card>
          </div>
        </Section>

        <Section title="피드백" desc="Modal(모바일은 바텀시트) · ConfirmModal · Toast — 창 너비를 640px 아래로 줄이면 시트로 바뀐다">
          <Row label="Modal">
            <Button variant="sub1" onClick={() => setModalOpen(true)}>
              입력 모달
            </Button>
            <Button variant="sub1" onClick={() => setSheetOpen(true)}>
              본문 있는 시트
            </Button>
          </Row>
          <Row label="ConfirmModal — default · warning · danger(loading)">
            <Button variant="sub1" onClick={() => setConfirm("default")}>
              기본 확인
            </Button>
            <Button variant="sub1" onClick={() => setConfirm("warning")}>
              경고 확인
            </Button>
            <Button variant="danger" onClick={() => setConfirm("danger")}>
              삭제 확인
            </Button>
          </Row>
          <Row label="Toast">
            {(Object.keys(TOAST_COPY) as ToastKind[]).map((kind) => (
              <Button key={kind} size="sm" variant="sub2" onClick={() => setToast(kind)}>
                {kind}
              </Button>
            ))}
          </Row>
        </Section>

        <Section title="레이아웃" desc="ClientHeader · PageContainer · BottomTab — 아래는 375px 폰 틀 (탭을 눌러 보면 활성 탭이 바뀐다)">
          {/* transform-gpu: 안의 fixed(BottomTab)가 화면이 아니라 이 틀에 붙는다. clip-path: 크롬은 backdrop-blur 인
              자식(헤더)을 overflow-hidden 의 둥근 모서리로 자르지 않는다 */}
          <div className="mx-auto w-[375px] max-w-full h-[600px] overflow-hidden rounded-card bg-bg shadow-card dark:shadow-card-dark transform-gpu">
            <div className="h-full overflow-y-auto scrollbar-hide [clip-path:inset(0_round_var(--radius-card))]">
              <ClientHeader title="주문 내역" onBack={() => navigate("/dev/ui")} right={<IconButton icon={<Search />} label="주문 검색" />} />
              <PageContainer bottomTab className="flex flex-col gap-3">
                {["오늘", "어제", "9월 28일", "9월 21일", "9월 14일"].map((day, i) => (
                  <Card key={day} padding="none">
                    <ListRow
                      leading={<ShoppingBag />}
                      title={`동네 김밥 · ${day}`}
                      sub="참치김밥 외 2개 · 14,500원"
                      trailing={i === 0 ? <Badge tone="info">배달 중</Badge> : <Badge>완료</Badge>}
                      onClick={() => setToast("info")}
                    />
                  </Card>
                ))}
              </PageContainer>
              <BottomTab items={TABS} />
            </div>
          </div>
        </Section>
      </PageContainer>

      {/* Modal 은 안에 내용(입력 · 선택 · 목록)이 있을 때. "~할까요?" 같은 예/아니오 질문은 ConfirmModal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="배달 요청"
        description="가게와 기사님께 전달돼요."
        primaryText="저장"
        onPrimary={() => {
          setModalOpen(false);
          setToast("success");
        }}
      >
        <div className="flex flex-col gap-3">
          <Select label="출입 방법" options={ENTRY_OPTIONS} value={entry} onChange={setEntry} />
          <TextField label="요청 사항" placeholder="예) 문 앞에 두고 벨 눌러 주세요" />
        </div>
      </Modal>
      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="받는 방법"
        description="가게마다 가능한 방법이 달라요."
        buttonCount={1}
        primaryText="선택 완료"
        onPrimary={() => setSheetOpen(false)}
      >
        <RadioGroup options={PICKUP_OPTIONS} value={pickup} onChange={setPickup} />
      </Modal>
      <ConfirmModal
        open={confirm === "default"}
        title="주소를 저장할까요?"
        description="다음 주문부터 자동으로 채워져요."
        onConfirm={() => setConfirm(null)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm === "warning"}
        variant="warning"
        title="영업 종료 30분 전이에요"
        description={
          <span>
            지금 주문하면 조리가 늦어질 수 있어요.
            <br />
            그래도 주문할까요?
          </span>
        }
        confirmLabel="주문하기"
        onConfirm={() => setConfirm(null)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm === "danger"}
        variant="danger"
        icon={<Trash2 />}
        title="주문을 취소할까요?"
        description="결제 금액은 3영업일 안에 돌아가요."
        confirmLabel="주문 취소"
        cancelLabel="유지하기"
        confirmLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
      {toast && (
        <Toast
          key={toast}
          open
          type={toast}
          title={TOAST_COPY[toast].title}
          description={TOAST_COPY[toast].description}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default UiPreview;
