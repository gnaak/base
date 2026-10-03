import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
  /** 앞에 상태색 점. 기본은 neutral 만 빼고 켠다 */
  dot?: boolean;
  /** 점 대신 아이콘 (lucide 아이콘이면 크기는 맞춰 준다) */
  icon?: ReactNode;
  className?: string;
}

// 상태색은 면(옅은 틴트)·링·점에만, 글자는 본문색이다 — 관리자 Toast·Alert 와 같은 규칙.
// 작은 글자를 point 색으로 칠하면 옅은 틴트 위에서 4.5:1 이 안 나오는 조합이 있다 (info 파랑 ≈ 4.1:1)
const tones: Record<Tone, { wrap: string; dot: string; icon: string }> = {
  neutral: { wrap: "bg-bg-hover ring-line", dot: "bg-text-sub", icon: "text-text-sub" },
  success: { wrap: "bg-success-bg ring-point-green/25", dot: "bg-point-green", icon: "text-point-green" },
  warning: { wrap: "bg-warning-bg ring-point-amber/30", dot: "bg-point-amber", icon: "text-point-amber" },
  error: { wrap: "bg-error-bg ring-point-red/25", dot: "bg-point-red", icon: "text-point-red" },
  info: { wrap: "bg-info-bg ring-point-blue/25", dot: "bg-point-blue", icon: "text-point-blue" },
};

const sizes = {
  sm: "h-5 px-1.5 gap-1 text-[11px]",
  md: "h-6 px-2 gap-1.5 text-[12px]",
} as const;

/**
 * 상태 뱃지 (결제 완료 · 배송 중 · 취소됨 …). 모서리는 컨트롤 토큰을 따른다.
 */
const Badge = ({ children, tone = "neutral", size = "md", dot, icon, className = "" }: BadgeProps) => {
  const t = tones[tone];
  const showDot = !icon && (dot ?? tone !== "neutral");

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-control font-client font-medium text-text-main ring-1 ring-inset",
        t.wrap,
        sizes[size],
        className,
      ].join(" ")}
    >
      {showDot && <span className={["w-1.5 h-1.5 rounded-full", t.dot].join(" ")} aria-hidden="true" />}
      {icon && (
        <span className={["flex [&_svg]:w-3 [&_svg]:h-3", t.icon].join(" ")} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
};

export default Badge;
