import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";

type Variant = "ghost" | "sub1" | "sub2" | "main";
type Size = "sm" | "md" | "lg";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  /** 글자가 없으니 이름이 필수다 — aria-label 과 툴팁(title)으로 쓴다. E2E 도 이 이름으로 찾는다 */
  label: string;
  variant?: Variant;
  size?: Size;
  ref?: Ref<HTMLButtonElement>;
}

const variants: Record<Variant, string> = {
  ghost: "text-text-sub enabled:hover:text-text-main enabled:hover:bg-bg-hover enabled:active:bg-bg-active",
  sub1: "bg-bg-card text-text-main shadow-border enabled:hover:bg-bg-hover enabled:active:bg-bg-active",
  sub2: "bg-bg-hover text-text-main enabled:hover:bg-bg-active enabled:active:bg-line-strong",
  main: "bg-primary text-text-inverse enabled:hover:bg-primary/90 enabled:active:bg-primary-dark",
};

// 정사각 — 한 변이 컨트롤 높이 토큰이라 md 가 44px 터치 영역이다
const sizes: Record<Size, { box: string; icon: string }> = {
  sm: { box: "w-control-sm h-control-sm", icon: "w-4 h-4" },
  md: { box: "w-control-md h-control-md", icon: "w-5 h-5" },
  lg: { box: "w-control-lg h-control-lg", icon: "w-6 h-6" },
};

/**
 * 글자 없는 아이콘 버튼 (뒤로 가기 · 닫기 · 장바구니 등). 고객 화면에서 날 `<button>` 대신 쓴다.
 */
const IconButton = ({
  icon,
  label,
  variant = "ghost",
  size = "sm",
  className = "",
  type = "button",
  ...props
}: IconButtonProps) => {
  const element = isValidElement(icon) ? (icon as ReactElement<{ className?: string }>) : null;

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-control transition-colors select-none",
        "focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size].box,
        className,
      ].join(" ")}
      {...props}
    >
      {element
        ? cloneElement(element, {
            className: [sizes[size].icon, element.props.className].filter(Boolean).join(" "),
          })
        : icon}
    </button>
  );
};

export default IconButton;
