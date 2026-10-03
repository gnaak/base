import type { HTMLAttributes, ReactNode } from "react";

type Padding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** none 은 ListRow 묶음처럼 안쪽이 스스로 여백을 가질 때 (`<Card padding="none" className="divide-y divide-line">`) */
  padding?: Padding;
  /** raised 는 여러 겹 그림자로 한 단계 떠 보인다 (로그인 카드처럼 화면의 주인공 하나에만) */
  variant?: "flat" | "raised";
  as?: "div" | "section" | "article" | "li";
}

const paddings: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-7",
};

/**
 * 고객 화면 카드 — 흰 면 + 1px 링(`shadow-border`), 모서리는 `rounded-card` 토큰.
 * 눌리는 카드가 필요하면 안에 ListRow 를 넣거나 ListRow 를 쓴다 (카드 자체는 버튼이 아니다).
 */
const Card = ({ children, padding = "md", variant = "flat", as: Tag = "div", className = "", ...props }: CardProps) => (
  <Tag
    className={[
      "rounded-card bg-bg-card text-text-main font-client overflow-hidden",
      variant === "raised" ? "shadow-card dark:shadow-card-dark" : "shadow-border",
      paddings[padding],
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </Tag>
);

export default Card;
