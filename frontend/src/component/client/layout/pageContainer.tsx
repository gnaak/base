import type { ReactNode } from "react";

type Size = "sm" | "md" | "lg";

interface PageContainerProps {
  children: ReactNode;
  /** 최대 폭 — sm 448px(폼 · 로그인) · md 672px(앱 화면, 기본) · lg 1152px(소개 · 랜딩) */
  size?: Size;
  /** 하단 탭이 있는 화면 — 마지막 내용이 탭에 가리지 않게 아래를 비운다 */
  bottomTab?: boolean;
  as?: "div" | "main" | "section";
  className?: string;
}

const sizes: Record<Size, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-6xl",
};

/**
 * 고객 화면 본문 틀 — 가운데 정렬 · 최대 폭 · 좌우 16px(sm 이상 24px) 여백.
 *
 * safe-area(노치 · 홈 인디케이터)는 body 가 네 방향 모두 이미 비워 둔다 (index.css). 여기서 또 더하면 두 배가 된다.
 * 하단 탭은 화면에 붙어(fixed) 있어서 body 여백과 상관없이 덮으니, `bottomTab` 이면 탭 높이(56px)+여유만큼 더 비운다.
 */
const PageContainer = ({ children, size = "md", bottomTab = false, as: Tag = "div", className = "" }: PageContainerProps) => (
  <Tag
    className={[
      "mx-auto w-full px-4 sm:px-6 pt-4 font-client",
      bottomTab ? "pb-24" : "pb-10",
      sizes[size],
      className,
    ].join(" ")}
  >
    {children}
  </Tag>
);

export default PageContainer;
