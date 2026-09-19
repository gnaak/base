import type { Column, TableRow } from "./table";

/**
 * `render`가 없을 때의 기본 셀 표시.
 *
 * 객체·배열은 `[object Object]`처럼 보이게 둔다 — 조용히 빈칸으로 만들면
 * 데이터가 없는 건지 표시를 안 한 건지 구분이 안 된다. 그런 값은 `render`로 직접 그릴 것.
 */
const defaultCell = (value: unknown): React.ReactNode =>
  value === null || value === undefined ? "" : String(value);

/**
 * TableBody 컴포넌트 Props
 *
 * @property columns       테이블 컬럼 정보 배열
 * @property data          렌더링할 실제 데이터 배열
 * @property rowSizeClass  테이블 행 높이/텍스트 크기 클래스 (Table 컴포넌트에서 계산해 전달)
 * @property striped       줄무늬(지브라) 스타일 적용 여부
 * @property rowCount      행 개수
 * @property onRowClick    각 행 클릭 시 호출되는 콜백
 */
interface TableBodyProps<Row extends TableRow> {
  columns: Column<Row>[];
  data: Row[];
  rowSizeClass: string;
  striped: boolean;
  rowCount?: number;
  onRowClick?: (row: Row) => void;
}

/**
 * TableBody 컴포넌트
 *
 * - 컬럼 정의(columns)에 따라 각 셀을 렌더링
 * - render 속성이 있는 경우 커스텀 렌더링 적용
 * - striped 옵션이 true면 홀수 행에 배경색 적용
 * - onRowClick이 전달되면 각 행 클릭 가능
 * - 데이터가 없을 경우 “데이터가 없습니다.” 메시지 출력
 *
 * @example 기본 사용
 * ```tsx
 * <TableBody
 *   columns={columns}
 *   data={rows}
 *   rowSizeClass="text-sm h-10"
 *   striped
 * />
 * ```
 */
const TableBody = <Row extends TableRow>({
  columns,
  data,
  rowSizeClass,
  striped,
  rowCount,
  onRowClick,
}: TableBodyProps<Row>) => {
  const target = rowCount && rowCount > 0 ? rowCount : data.length;
  const emptyCount = Math.max(0, target - data.length);
  return (
    <tbody>
      {data.map((row, index) => {
        const stripedClass =
          striped && index % 2 === 1 ? "bg-[#FFF6DA]" : "bg-white";
        return (
          <tr
            key={`row-${index}`}
            className={`${rowSizeClass} ${stripedClass}`}
            onClick={() => {
              if (onRowClick) onRowClick(row);
            }}
          >
            {columns.map((col) => {
              const alignClass =
                col.align === "center"
                  ? "text-center"
                  : col.align === "right"
                    ? "text-right"
                    : "text-left";

              return (
                <td
                  key={col.key}
                  className={`px-3 py-2.5 align-middle ${alignClass} ${index < data.length - 1 ? "border-b border-gray-200" : ""}`}
                >
                  {col.render ? col.render(row) : defaultCell(row[col.key])}
                </td>
              );
            })}
          </tr>
        );
      })}

      {emptyCount > 0 &&
        Array.from({ length: emptyCount }).map((_, i) => (
          <tr key={`empty-${i}`} className={rowSizeClass}>
            {columns.map((col) => (
              <td key={col.key} className="px-3 py-2.5 bg-white">
                &nbsp;
              </td>
            ))}
          </tr>
        ))}
    </tbody>
  );
};

export default TableBody;
