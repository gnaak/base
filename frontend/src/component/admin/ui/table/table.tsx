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
 * 테이블이 다루는 행. 값의 타입은 자유이고, 표시 방법은 `Column.render`로 정한다.
 *
 * 보통은 이걸 직접 쓰지 않고 도메인 타입을 그대로 넘긴다 —
 * `<Table<UserRow> columns={...} data={users} />` 처럼 쓰면 `render`의 인자에도
 * `UserRow`가 붙는다.
 */
export type TableRow = Record<string, unknown>;

/**
 * Table 열(Column) 정의
 *
 * @property key     행 데이터에서 읽을 key
 * @property header  테이블 헤더에 표시될 텍스트
 * @property width   개별 컬럼 가로 너비 (예: "150px" 또는 "20%")
 * @property align   정렬(left/center/right)
 * @property render  셀 커스텀 렌더 함수(row → ReactNode). 객체·배열 값은 여기서 직접 그린다
 */
export interface Column<Row extends TableRow = TableRow> {
  key: string;
  header: string;
  width?: string;
  align?: Align;
  render?: (row: Row) => React.ReactNode;
  icon?: React.ReactNode;
}

/** 헤더는 행 데이터를 보지 않으므로 `render`를 뺀 형태만 받는다. */
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
 */
interface TableProps<Row extends TableRow> {
  columns: Column<Row>[];
  data: Row[];
  size?: Size;
  striped?: boolean;
  className?: string;
  onRowClick?: (row: Row) => void;
  rowCount?: number;
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
 * @example 커스텀 렌더링 + 타입 지정
 * ```tsx
 * interface UserRow { id: number; name: string; status: "on" | "off" }
 *
 * const columns: Column<UserRow>[] = [
 *   { key: "name", header: "이름" },
 *   { key: "status", header: "상태", render: (row) => <StatusTag type={row.status} /> },
 * ];
 *
 * <Table columns={columns} data={users} />   // data로 Row가 추론된다
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
}: TableProps<Row>) => {
  const rowSizeClass = sizeStyles[size];
  const isEmpty = data.length === 0;
  return (
    <div className={`relative w-full overflow-x-auto flex flex-col ${className}`}>
      <table className="table-fixed w-full border-collapse overflow-hidden bg-white rounded-b-xl">
        <TableHeader columns={columns} rowSizeClass={rowSizeClass} />
        <TableBody
          columns={columns}
          data={data}
          rowSizeClass={rowSizeClass}
          striped={striped}
          rowCount={rowCount}
          onRowClick={onRowClick}
        />
      </table>

      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-gray-500">데이터가 없습니다.</span>
        </div>
      )}
    </div>
  );
};

export default Table;
