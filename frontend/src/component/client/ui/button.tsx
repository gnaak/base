import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import Spinner from "./spinner";

export type ButtonVariant = "main" | "sub1" | "sub2" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /**
   * 관리자 Button 과 같은 이름 — main(주 동작) · sub1(보조, 흰 면 + 1px 링) · sub2(옅은 회색 면) · danger(파괴적).
   * ghost 는 고객 화면에만 있다 ("다음에 할게요" 같은 글자 버튼 — 날 `<button>` 을 쓰지 않게)
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  full?: boolean;
  /** 진행 중 — 눌리지 않고(disabled) aria-busy 가 붙고 왼쪽 아이콘 자리에 스피너가 돈다. 글자는 그대로라 폭이 안 튄다 */
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const variants: Record<ButtonVariant, string> = {
  main: "bg-primary text-text-inverse enabled:hover:bg-primary/90 enabled:active:bg-primary-dark",
  // 관리자 ConfirmModal 의 취소 버튼과 같은 모양 — 흰 면 + 1px 링
  sub1: "bg-bg-card text-text-main shadow-border enabled:hover:bg-bg-hover enabled:active:bg-bg-active",
  sub2: "bg-bg-hover text-text-main enabled:hover:bg-bg-active enabled:active:bg-line-strong",
  danger: "bg-point-red text-text-inverse enabled:hover:bg-point-red/90 enabled:active:bg-point-red/80",
  ghost: "bg-transparent text-text-main enabled:hover:bg-bg-hover enabled:active:bg-bg-active",
};

// 높이는 --control-h-* 토큰 (md = 44px 터치 최소 크기). 글자가 길어 두 줄이 되면 늘어난다
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-control-sm px-3 py-1.5 text-[13px] gap-1.5",
  md: "min-h-control-md px-4 py-1.5 text-[15px] gap-2",
  lg: "min-h-control-lg px-5 py-2 text-[16px] gap-2",
};

const iconSizes: Record<ButtonSize, string> = {
  sm: "w-4 h-4",
  md: "w-[18px] h-[18px]",
  lg: "w-5 h-5",
};

/**
 * 고객 화면 버튼. API 는 관리자 `component/admin/ui/form/button.tsx` 와 같다 (+ loading · ghost).
 *
 * 다른 점: 높이는 control 토큰, 모서리는 `rounded-control`, 글꼴은 `font-client` — 테마가 모양까지 바꾼다.
 * `type` 기본값이 "button" 이다 (폼 안에서 의도치 않게 submit 되지 않게). 제출 버튼은 `type="submit"`.
 */
const Button = ({
  children,
  variant = "main",
  size = "md",
  leftIcon = null,
  rightIcon = null,
  full = false,
  loading = false,
  className = "",
  disabled,
  type = "button",
  ...props
}: ButtonProps) => {
  const renderIcon = (icon: ReactNode) => {
    if (!icon || !isValidElement(icon)) return null;
    const element = icon as ReactElement<{ className?: string }>;
    return cloneElement(element, {
      className: [iconSizes[size], element.props.className].filter(Boolean).join(" "),
    });
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex shrink-0 items-center justify-center text-center leading-tight",
        "rounded-control font-client font-medium tracking-tight select-none transition-colors",
        "focus-visible:outline-none focus-visible:shadow-focus",
        full ? "w-full" : "w-max min-w-fit",
        variants[variant],
        sizes[size],
        loading ? "cursor-wait opacity-80" : "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ].join(" ")}
      {...props}
    >
      {loading ? (
        <Spinner size="sm" />
      ) : (
        leftIcon && <span className="flex items-center">{renderIcon(leftIcon)}</span>
      )}
      {children}
      {rightIcon && <span className="flex items-center">{renderIcon(rightIcon)}</span>}
    </button>
  );
};

export default Button;
