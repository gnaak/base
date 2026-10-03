interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  /** 화면 읽기 프로그램에 읽힐 이름. 없으면 장식으로 보고 숨긴다 (버튼은 aria-busy 로 알린다) */
  label?: string;
  className?: string;
}

const sizeMap: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-10 h-10 border-[3px]",
};

/**
 * 도는 원. 글자색(currentColor)을 따라가서 어느 버튼·배경 위에서도 보인다.
 * 데이터 자리 로딩은 이것보다 Skeleton 이 낫다 — 자리를 먼저 잡아서 화면이 튀지 않는다.
 */
const Spinner = ({ size = "md", label, className = "" }: SpinnerProps) => (
  <span
    role={label ? "status" : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    className={[
      "inline-block shrink-0 rounded-full border-current border-t-transparent animate-spin",
      sizeMap[size],
      className,
    ].join(" ")}
  />
);

export default Spinner;
