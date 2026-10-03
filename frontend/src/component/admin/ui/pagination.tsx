import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationSize = "sm" | "md";

/**
 * 페이지 맨 아래 가운데에 붙는다 — **항상** 기준 상자의 bottom 15px (absolute). 데이터가 없으면 그리지 않는다.
 * 기준 상자는 관리자 레이아웃의 본문(`container/admin/layout.tsx` — relative · min-h-full · 아래 여백)이다.
 * 그래서 카드처럼 relative 인 상자 안에 넣지 말고 **페이지의 맨 바깥**에 둔다.
 * 표 길이에 따라 위치가 들썩이지 않게 한 것이다 (사람이 정했다 · DESIGN.md "사람이 정한 취향").
 * 예전의 `variant="flow"`(흐름에 두기)는 없앴다 — 무인 개발이 그걸 골라 페이지마다 위치가 달랐다.
 */

interface Props {
  page: number;
  total: number;
  onChange: (page: number) => void;
  visibleCount?: number;
  pageSize?: number;
  size?: PaginationSize;
  className?: string;
}

const Pagination = ({
  page,
  total,
  onChange,
  visibleCount = 5,
  pageSize = 10,
  size = "md",

  className = "",
}: Props) => {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const count = Math.max(1, Math.min(visibleCount, totalPages));

  const currentPage = Math.min(Math.max(1, page), totalPages);

  const start = Math.floor((currentPage - 1) / count) * count + 1;

  const end = Math.min(totalPages, start + count - 1);

  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const base =
    "inline-flex items-center justify-center rounded-md border text-sm transition";

  const sizeClass = size === "sm" ? "h-7 min-w-7 px-1" : "h-8 min-w-8 px-2";

  const normal = "border-line text-text-sub bg-bg-card hover:bg-bg-hover";

  const active = "!bg-primary !text-text-inverse !border-primary";

  const disabled = "opacity-40 pointer-events-none cursor-default";

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  const handlePrevGroup = () => {
    if (start === 1) return;
    onChange(start - 1);
  };

  const handleNextGroup = () => {
    if (end === totalPages) return;
    onChange(Math.min(totalPages, start + count));
  };

  const handleClickPage = (p: number) => {
    if (p !== currentPage) {
      onChange(p);
    }
  };

  const nav = (
    <nav
      className={`flex items-center gap-2 select-none`}
      aria-label="Pagination"
    >
      <button
        type="button"
        className={`${base} ${sizeClass} ${normal} ${
          start === 1 ? disabled : ""
        }`}
        onClick={handlePrevGroup}
        aria-label="Previous pages group"
        disabled={start === 1}
      >
        <ChevronLeft className={iconSize} />
      </button>

      {pages.map((p) => {
        const isActive = p === currentPage;
        return (
          <button
            key={p}
            type="button"
            onClick={() => handleClickPage(p)}
            aria-current={isActive ? "page" : undefined}
            className={`${base} ${sizeClass} ${isActive ? active : normal}`}
          >
            {p}
          </button>
        );
      })}

      <button
        type="button"
        className={`${base} ${sizeClass} ${normal} ${
          end === totalPages ? disabled : ""
        }`}
        onClick={handleNextGroup}
        aria-label="Next pages group"
        disabled={end === totalPages}
      >
        <ChevronRight className={iconSize} />
      </button>
    </nav>
  );

  return (
    <div className={`absolute bottom-[15px] left-1/2 -translate-x-1/2 ${className}`}>
      {nav}
    </div>
  );
};

export default Pagination;
