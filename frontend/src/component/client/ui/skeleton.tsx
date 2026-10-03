interface SkeletonProps {
  /** 크기는 className 으로 (예: "h-4 w-32"). 모서리 기본은 `rounded-control` — 원이면 "rounded-full" 을 같이 준다 */
  className?: string;
}

/**
 * 고객 화면 스켈레톤 — 관리자 Skeleton 과 같고 모서리만 컨트롤 토큰을 따른다.
 * 실제 콘텐츠와 같은 높이로 잡아야 데이터가 들어올 때 화면이 튀지 않는다.
 */
const Skeleton = ({ className = "" }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={["relative overflow-hidden bg-skeleton-base", className.includes("rounded") ? "" : "rounded-control", className].join(" ")}
  >
    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-skeleton-shine to-transparent animate-shimmer motion-reduce:animate-none" />
  </div>
);

export default Skeleton;
