import { ArrowUpRight, Clock, TrendingUp, Users } from "lucide-react";

import Table, { type Column } from "@/component/admin/ui/table/table";
import StatCard from "@/component/admin/ui/statCard";

/**
 * 관리자 대시보드 — **샘플 화면이다.**
 *
 * 프로젝트마다 지우고 다시 쓰는 자리지만, 디자인 시스템을 어떻게 쓰는지
 * 보여주는 본보기이기도 하다:
 *
 * - `StatCard` 로 상단 지표, `loading` 을 넘기면 같은 높이의 스켈레톤이 자리를 잡는다
 *   (0을 먼저 그리면 실제 값으로 바뀔 때 숫자가 튀는 깜빡임이 된다)
 * - `Table` 은 `Row` 제네릭을 받는다 — `render` 의 인자에도 타입이 붙는다
 * - 깊이는 `border` 가 아니라 `shadow-border` 로 준다 (1px 링, 다크모드 자동 전환)
 * - 숫자가 세로로 정렬되는 곳에는 `tabular-nums`
 *
 * 실제 데이터는 `useGet` 으로 받아 `loading` 을 그대로 넘기면 된다:
 *
 *   const { data, isLoading } = useGet<Page<UserOut>>("api/admin/users", ["admin-users"]);
 */

interface RecentUser extends Record<string, unknown> {
  id: number;
  name: string;
  email: string;
  plan: "free" | "pro";
  joinedAt: string;
}

// 백엔드를 붙이기 전까지 화면을 확인하기 위한 예시 데이터.
const SAMPLE_USERS: RecentUser[] = [
  { id: 1, name: "김하늘", email: "haneul@example.com", plan: "pro", joinedAt: "2026-09-19" },
  { id: 2, name: "이도윤", email: "doyun@example.com", plan: "free", joinedAt: "2026-09-18" },
  { id: 3, name: "박서준", email: "seojun@example.com", plan: "pro", joinedAt: "2026-09-18" },
  { id: 4, name: "최유나", email: "yuna@example.com", plan: "free", joinedAt: "2026-09-17" },
  { id: 5, name: "정민서", email: "minseo@example.com", plan: "free", joinedAt: "2026-09-16" },
];

const planBadge = (plan: RecentUser["plan"]) => (
  <span
    className={[
      "inline-flex items-center rounded-subtle px-1.5 py-0.5 text-[11px] font-medium",
      plan === "pro"
        ? "bg-info-bg text-point-blue"
        : "bg-bg-sub text-text-sub shadow-border",
    ].join(" ")}
  >
    {plan === "pro" ? "Pro" : "Free"}
  </span>
);

const columns: Column<RecentUser>[] = [
  { key: "name", header: "이름", width: "20%" },
  { key: "email", header: "이메일" },
  { key: "plan", header: "플랜", width: "12%", align: "center", render: (row) => planBadge(row.plan) },
  {
    key: "joinedAt",
    header: "가입일",
    width: "18%",
    align: "right",
    render: (row) => <span className="tabular-nums text-text-sub">{row.joinedAt}</span>,
  },
];

const AdminMain = () => {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 flex flex-col gap-8">
      {/* 페이지 헤더 */}
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-title text-text-main">
          대시보드
        </h1>
        <p className="text-[13px] text-text-sub">
          샘플 화면입니다. <code className="font-mono text-[12px]">container/admin/main.tsx</code>
          를 프로젝트에 맞게 바꾸세요.
        </p>
      </header>

      {/* 지표 */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="w-3.5 h-3.5" />}
          label="전체 사용자"
          value={<span className="tabular-nums">1,284</span>}
          note="지난 7일 +42"
          large
        />
        <StatCard
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="활성 세션"
          value={<span className="tabular-nums">312</span>}
          note="동시 접속 기준"
        />
        <StatCard
          icon={<ArrowUpRight className="w-3.5 h-3.5" />}
          label="오늘 가입"
          value={<span className="tabular-nums">18</span>}
        />
        <StatCard
          icon={<Clock className="w-3.5 h-3.5" />}
          label="평균 응답"
          value={<span className="tabular-nums">128ms</span>}
          note="최근 1시간"
          tone="warning"
        />
      </section>

      {/* 목록 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-text-main">
            최근 가입
          </h2>
          <span className="text-[12px] text-text-sub">최근 5건</span>
        </div>
        <Table columns={columns} data={SAMPLE_USERS} size="md" />
      </section>
    </div>
  );
};

export default AdminMain;
