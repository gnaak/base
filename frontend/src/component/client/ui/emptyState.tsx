import type { ReactNode } from "react";

interface EmptyStateProps {
  /** lucide 아이콘 등 — 옅은 원 안에 들어간다 */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** 다음 할 일 버튼 (예: `<Button size="sm">첫 주문 하기</Button>`) */
  action?: ReactNode;
  className?: string;
}

/**
 * 빈 목록 · 검색 결과 없음 · 아직 없는 데이터. "없음" 으로 끝내지 말고 다음 할 일(action)을 같이 준다.
 * 로딩 중에는 이걸 그리지 않는다 — 그때는 Skeleton (빈 화면이 먼저 번쩍이면 오류로 보인다).
 */
const EmptyState = ({ icon, title, description, action, className = "" }: EmptyStateProps) => (
  <div className={["flex flex-col items-center text-center px-6 py-12 font-client", className].join(" ")}>
    {icon && (
      <div className="mb-4 w-14 h-14 rounded-full bg-bg-sub shadow-border flex items-center justify-center text-text-sub [&_svg]:w-6 [&_svg]:h-6">
        {icon}
      </div>
    )}
    <p className="text-[15px] font-semibold tracking-tight text-text-main">{title}</p>
    {description && <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-text-sub">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
