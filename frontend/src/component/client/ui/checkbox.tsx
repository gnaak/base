import type { ComponentProps, ReactNode } from "react";
import { Check } from "lucide-react";

type Size = "sm" | "md" | "lg";

interface CheckboxProps extends Omit<ComponentProps<"input">, "onChange" | "size" | "type" | "checked"> {
  label?: ReactNode;
  /** 안 주면 비제어(defaultChecked) 로 동작한다 */
  checked?: boolean;
  /** 관리자 Checkbox 처럼 바뀐 체크 상태를 넘긴다 */
  onChange?: (checked: boolean) => void;
  size?: Size;
  className?: string;
}

// 줄 높이는 컨트롤 토큰 — 글자까지 눌러도 체크되고(label), md 줄 전체가 44px 터치 영역이다
const sizeStyles: Record<Size, { row: string; box: string; icon: string; text: string }> = {
  sm: { row: "min-h-control-sm gap-2", box: "w-4 h-4", icon: "w-3 h-3", text: "text-[13px]" },
  md: { row: "min-h-control-md gap-2.5", box: "w-5 h-5", icon: "w-3.5 h-3.5", text: "text-[15px]" },
  lg: { row: "min-h-control-lg gap-3", box: "w-6 h-6", icon: "w-4 h-4", text: "text-[16px]" },
};

/**
 * 고객 화면 체크박스. API 는 관리자 Checkbox 와 같다 (label · checked · onChange(checked) · disabled · size).
 *
 * 네이티브 input 을 그대로 쓰고 모양만 입혔다 — 키보드(스페이스)·폼 제출·화면 읽기가 따라온다.
 * 모서리는 컨트롤 토큰의 절반이라 테마가 각지면 같이 각진다.
 */
const Checkbox = ({ label, checked, onChange, disabled = false, size = "sm", className = "", ...props }: CheckboxProps) => {
  const s = sizeStyles[size];

  return (
    <label
      className={[
        "inline-flex items-center select-none font-client text-text-main",
        s.row,
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className={[
            "peer m-0 appearance-none border border-line-strong bg-input-bg transition-colors",
            "rounded-[calc(var(--radius-control)*0.5)]",
            "checked:border-primary checked:bg-primary",
            "focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed",
            s.box,
          ].join(" ")}
          {...props}
        />
        <Check
          strokeWidth={3}
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-0 m-auto text-text-inverse opacity-0 peer-checked:opacity-100",
            s.icon,
          ].join(" ")}
        />
      </span>
      {label && <span className={s.text}>{label}</span>}
    </label>
  );
};

export default Checkbox;
