import Skeleton from "@/component/admin/ui/skeleton";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** 값 아래 한 줄 부연 (예: "구독중 3 · 해지 예정 1"). */
  note?: React.ReactNode;
  loading?: boolean;
  large?: boolean;
  /** 조치가 필요한 수치(청구 실패 등)를 경고색으로 강조. */
  tone?: "default" | "warning" | "danger";
}

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-text-main",
  warning: "text-point-amber",
  danger: "text-point-red",
};

/**
 * 관리자 화면 상단 지표 카드.
 *
 * 값이 오기 전에 0을 먼저 그리면 실제 수치로 바뀔 때 숫자가 튀는 깜빡임이 된다.
 * 그래서 로딩 중에는 같은 높이의 스켈레톤으로 자리를 잡아둔다.
 */
const StatCard = ({
  icon,
  label,
  value,
  note,
  loading,
  large,
  tone = "default",
}: StatCardProps) => (
  <div className="rounded-comfy bg-bg-card shadow-border px-4 py-3.5 flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5 text-text-sub">
      {icon}
      <span className="text-[11px] font-medium uppercase tracking-tight">
        {label}
      </span>
    </div>
    <div
      className={[
        "font-semibold tracking-tight",
        large ? "text-[24px]" : "text-[18px]",
        toneClass[tone],
      ].join(" ")}
    >
      {loading ? (
        <Skeleton className={large ? "h-[29px] w-24" : "h-[22px] w-16"} />
      ) : (
        value
      )}
    </div>
    {note && !loading && (
      <div className="text-[11px] text-text-sub leading-tight">{note}</div>
    )}
  </div>
);

export default StatCard;
