import TableHeader from "./tableHeader";
import TableBody from "./tableBody";

/**
 * 테이블 행 높이 및 텍스트 크기 타입
 */
export type Size = "sm" | "md" | "lg";

/**
 * 열 정렬 방식 타입
 */
export type Align = "left" | "center" | "right";

/**
 * Table 열(Column) 정의
 *
 * @property key     행 데이터에서 읽을 key
 * @property header  테이블 헤더에 표시될 텍스트
 * @property width   개별 컬럼 가로 너비 (예: "150px" 또는 "20%")
 * @property align   정렬(left/center/right)
 * @property render  셀 커스텀 렌더 함수(row → ReactNode)
 * @property rowCount 행 개수
 */
/** 테이블이 다루는 행. 값의 타입은 자유이고, 표시 방법은 `Column.render`로 정한다. */
export type TableRow = Record<string, unknown>;

export interface Column<Row extends TableRow = TableRow> {
  key: string;
  header: string;
  width?: string;
  align?: Align;
  render?: (row: Row) => React.ReactNode;
  icon?: React.ReactNode;
}

/** 헤더는 행 데이터를 보지 않으므로 `render`를 뺀 형태만 받는다 (변성 문제 회피). */
export type HeaderColumn = Omit<Column, "render">;

/**
 * Table 컴포넌트 Props
 *
 * @property columns    테이블 컬럼 설정 배열
 * @property data       테이블에 표시할 데이터
 * @property size       행 크기(sm/md/lg)
 * @property striped    홀/짝 줄 배경색 적용 여부
 * @property className  외부 wrapper 커스텀 클래스
 * @property onRowClick 행 클릭 시 호출되는 콜백(row 전달)
 * @property rowCount 행 개수
 * @property loading   데이터 로딩 중이면 빈 상태 대신 스켈레톤 행을 표시
 */
interface TableProps<Row extends TableRow> {
  columns: Column<Row>[];
  data: Row[];
  size?: Size;
  striped?: boolean;
  className?: string;
  onRowClick?: (row: Row) => void;
  rowCount?: number;
  loading?: boolean;
  icon?: React.ReactNode;
}

/**
 * 테이블 행 사이즈별 클래스
 */
const sizeStyles: Record<Size, string> = {
  sm: "text-xs h-8",
  md: "text-sm h-10",
  lg: "text-base h-12",
};

/**
 * 재사용 가능한 Table 컴포넌트
 *
 * - columns 배열을 기반으로 header/body 자동 구성
 * - render 함수로 셀 단위 커스텀 UI 가능
 * - striped 옵션으로 줄무늬 테이블 표현
 * - row 클릭 핸들링(onRowClick) 지원
 *
 * @example 기본 사용
 * ```tsx
 * const columns = [
 *   { key: "name", header: "이름" },
 *   { key: "age", header: "나이", align: "center" },
 * ];
 *
 * <Table columns={columns} data={rows} />
 * ```
 *
 * @example 커스텀 렌더링
 * ```tsx
 * const columns = [
 *   {
 *     key: "status",
 *     header: "상태",
 *     render: (row) => <StatusTag type={row.status} />,
 *   },
 * ];
 * ```
 */
const Table = <Row extends TableRow>({
  columns,
  data,
  size = "md",
  striped = false,
  className = "",
  onRowClick,
  rowCount,
  loading,
}: TableProps<Row>) => {
  const rowSizeClass = sizeStyles[size];
  return (
    <div
      className={[
        "relative w-full overflow-x-auto flex flex-col",
        "rounded-xl bg-bg-card ring-1 ring-line",
        className,
      ].join(" ")}
    >
      <table className="table-fixed w-full border-collapse">
        <TableHeader columns={columns} rowSizeClass={rowSizeClass} />
        <TableBody
          columns={columns}
          data={data}
          rowSizeClass={rowSizeClass}
          striped={striped}
          rowCount={rowCount}
          loading={loading}
          onRowClick={onRowClick}
        />
      </table>
    </div>
  );
};

export default Table;
