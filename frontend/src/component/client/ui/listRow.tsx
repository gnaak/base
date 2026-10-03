import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface ListRowProps {
  /** 왼쪽 — 아이콘 · 썸네일 · 아바타 */
  leading?: ReactNode;
  title: ReactNode;
  /** 제목 아래 회색 한 줄 */
  sub?: ReactNode;
  /** 오른쪽 — 값 · Badge · Toggle. 눌리는 줄이면 뒤에 › 가 붙는다 */
  trailing?: ReactNode;
  /** 있으면 `<button>` 으로 그린다 */
  onClick?: () => void;
  /** 있으면 react-router `<Link>` 로 그린다 (onClick 보다 우선) */
  to?: string;
  /** 눌리는 줄의 › 를 끈다 */
  chevron?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * 목록 한 줄 (설정 · 주문 내역 · 메뉴). `to` 면 링크, `onClick` 이면 버튼, 둘 다 없으면 그냥 줄이다.
 *
 * 묶을 때는 `<Card padding="none" className="divide-y divide-line">` 안에 넣는다.
 * 줄 안에 Toggle 같은 컨트롤을 넣을 땐 onClick·to 를 주지 않는다 (버튼 안의 버튼이 된다).
 */
const ListRow = ({
  leading,
  title,
  sub,
  trailing,
  onClick,
  to,
  chevron = true,
  disabled = false,
  className = "",
}: ListRowProps) => {
  const interactive = !!to || !!onClick;

  const content = (
    <>
      {leading && <span className="flex shrink-0 items-center text-text-sub [&_svg]:w-5 [&_svg]:h-5">{leading}</span>}
      <span className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
        <span className="text-[14px] font-medium tracking-tight text-text-main truncate">{title}</span>
        {sub && <span className="text-[13px] text-text-sub truncate">{sub}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2 text-[13px] text-text-sub">{trailing}</span>}
      {interactive && chevron && <ChevronRight className="w-[18px] h-[18px] shrink-0 text-text-disabled" aria-hidden="true" />}
    </>
  );

  const base = ["flex w-full items-center gap-3 min-h-control-lg px-4 py-3 font-client", className].join(" ");
  // 카드(overflow-hidden) 안에서 바깥 링은 잘리니 포커스는 안쪽 링으로
  const pressable = [
    base,
    "transition-colors hover:bg-bg-hover active:bg-bg-active",
    "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--border-focus))]",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" ");

  if (to && !disabled) {
    return (
      <Link to={to} className={pressable}>
        {content}
      </Link>
    );
  }
  if (onClick || to) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={pressable}>
        {content}
      </button>
    );
  }
  return <div className={base}>{content}</div>;
};

export default ListRow;
