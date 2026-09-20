interface SkeletonProps {
  /** 크기·모양은 전부 className으로 지정한다 (예: "h-4 w-32 rounded-full"). */
  className?: string;
}

/**
 * 관리자 화면용 스켈레톤 블록. 데이터 도착 전 자리를 대신 차지한다.
 *
 * 실제 콘텐츠와 같은 높이로 잡아야 데이터가 들어올 때 레이아웃이 튀지 않는다.
 */
const Skeleton = ({ className = "" }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={[
      "relative overflow-hidden bg-skeleton-base rounded-DEFAULT",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    <div
      className="
        absolute inset-0 -translate-x-full
        bg-gradient-to-r from-transparent via-skeleton-shine to-transparent
        animate-shimmer motion-reduce:animate-none
      "
    />
  </div>
);

export default Skeleton;
