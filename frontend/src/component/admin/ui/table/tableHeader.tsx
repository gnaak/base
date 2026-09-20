import type { HeaderColumn } from "./table";

/**
 * TableHeader 컴포넌트 Props
 *
 * @property columns        테이블 컬럼 정의 배열
 * @property rowSizeClass   행 높이 및 텍스트 크기 클래스 (Table에서 전달)
 */
interface TableHeaderProps {
  // 헤더는 render 를 보지 않는다 (Column<Row> 를 그대로 받으면 변성 문제가 생긴다)
  columns: HeaderColumn[];
  rowSizeClass: string;
}

/**
 * TableHeader 컴포넌트
 *
 * - 컬럼 정의(columns)를 기반으로 테이블 헤더(th)를 렌더링합니다.
 * - `align` 값(left, center, right)에 따라 텍스트 정렬 적용
 * - `width`가 지정된 경우 해당 컬럼에 직접 style width 적용
 * - Table에서 공통적으로 전달되는 rowSizeClass는 th에도 동일하게 적용하여 행 높이 통일
 *
 * @example 기본 사용
 * ```tsx
 * <TableHeader
 *   columns={columns}
 *   rowSizeClass="text-sm h-10"
 * />
 * ```
 */
const TableHeader = ({ columns, rowSizeClass }: TableHeaderProps) => {
  return (
    <thead className="bg-bg-sub border-b border-line">
      <tr className={rowSizeClass}>
        {columns.map((col) => {
          const alignClass =
            col.align === "center"
              ? "text-center justify-center"
              : col.align === "right"
                ? "text-right justify-end"
                : "text-left justify-start";

          return (
            <th
              key={col.key}
              className="px-3 py-2 text-[12px] font-semibold uppercase tracking-tight text-text-sub"
              style={col.width ? { width: col.width } : undefined}
            >
              <div className={`flex items-center gap-1 ${alignClass}`}>
                <span>{col.header}</span>
                {col.icon && (
                  <span className="text-text-disabled">{col.icon}</span>
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
};

export default TableHeader;
