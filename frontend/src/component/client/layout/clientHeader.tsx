import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import IconButton from "@/component/client/ui/iconButton";

interface ClientHeaderProps {
  /** 가운데 제목 (`<h1>`). 길면 말줄임 */
  title?: ReactNode;
  /** 있으면 왼쪽에 뒤로 가기 버튼. 보통 `() => navigate(-1)` — 이동은 컨테이너가 정한다 */
  onBack?: () => void;
  backLabel?: string;
  /** 뒤로 가기 대신 왼쪽에 둘 것 (로고 · 워드마크) */
  left?: ReactNode;
  /** 오른쪽 (IconButton · ThemeToggle 등) */
  right?: ReactNode;
  /** 스크롤해도 위에 붙어 있을지 (기본 true) */
  sticky?: boolean;
  className?: string;
}

/**
 * 고객 화면 상단 바 — 높이 56px, 왼쪽(뒤로/로고) · 가운데 제목 · 오른쪽 슬롯.
 *
 * sticky 일 때 노치(safe-area) 아래에 붙고, 그 위 띠는 배경색으로 덮어 스크롤되는 글자가 상태 표시줄에 비치지 않는다.
 * (body 가 이미 safe-area 만큼 안쪽 여백을 줘서, 처음 위치는 그대로 노치 아래다 — index.css)
 */
const ClientHeader = ({
  title,
  onBack,
  backLabel = "뒤로 가기",
  left,
  right,
  sticky = true,
  className = "",
}: ClientHeaderProps) => (
  <header
    className={[
      "z-30 h-14 shrink-0 flex items-center justify-between gap-2 px-1.5 font-client",
      "bg-bg/90 backdrop-blur border-b border-line",
      sticky
        ? "sticky top-[env(safe-area-inset-top)] before:absolute before:inset-x-0 before:bottom-full before:h-[env(safe-area-inset-top)] before:bg-bg"
        : "relative",
      className,
    ].join(" ")}
  >
    <div className="flex min-w-0 items-center">
      {onBack ? <IconButton icon={<ChevronLeft />} label={backLabel} onClick={onBack} /> : left}
    </div>
    {title && (
      <h1 className="absolute left-1/2 max-w-[60%] -translate-x-1/2 truncate text-[15px] font-semibold tracking-tight text-text-main">
        {title}
      </h1>
    )}
    <div className="flex items-center gap-1">{right}</div>
  </header>
);

export default ClientHeader;
