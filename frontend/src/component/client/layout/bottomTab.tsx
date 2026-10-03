import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface BottomTabItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** 정확히 그 경로일 때만 활성. "/" 는 안 줘도 켜진다 (없으면 모든 경로에서 활성으로 보인다) */
  end?: boolean;
}

interface BottomTabProps {
  items: BottomTabItem[];
  /** `<nav>` 의 이름 — 화면 읽기 프로그램용 */
  label?: string;
  className?: string;
}

/**
 * 고객 화면 하단 탭 — 화면 아래에 붙는다(fixed). 지금 경로의 탭이 주 색으로 켜지고 `aria-current="page"` 가 붙는다 (NavLink).
 *
 * - 높이 56px + 홈 인디케이터(safe-area) 만큼 아래 여백. 본문은 `PageContainer bottomTab` 으로 그만큼 비운다
 * - 탭은 3~5개. 그보다 많으면 "더보기" 탭으로 묶는다
 */
const BottomTab = ({ items, label = "주요 메뉴", className = "" }: BottomTabProps) => (
  <nav
    aria-label={label}
    className={[
      "fixed inset-x-0 bottom-0 z-40 font-client",
      "bg-bg-card/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]",
      className,
    ].join(" ")}
  >
    <ul className="mx-auto flex max-w-2xl">
      {items.map(({ label: itemLabel, to, icon: Icon, end }) => (
        <li key={to} className="flex-1 min-w-0">
          <NavLink
            to={to}
            end={end ?? to === "/"}
            className={({ isActive }) =>
              [
                "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--border-focus))]",
                isActive ? "text-primary" : "text-text-sub hover:text-text-main",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                <span className="max-w-full truncate px-1">{itemLabel}</span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

export default BottomTab;
