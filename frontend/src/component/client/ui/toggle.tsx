import { useState, type ButtonHTMLAttributes } from "react";

type ToggleSize = "sm" | "md" | "lg";

interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type" | "role"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  size?: ToggleSize;
  disabled?: boolean;
  className?: string;
}

// 트랙 · 손잡이 · 켜졌을 때 이동 거리 (양옆 여백 2px)
const sizes: Record<ToggleSize, { track: string; thumb: string; on: string }> = {
  sm: { track: "w-8 h-[18px]", thumb: "w-3.5 h-3.5", on: "translate-x-3.5" },
  md: { track: "w-11 h-6", thumb: "w-5 h-5", on: "translate-x-5" },
  lg: { track: "w-[52px] h-7", thumb: "w-6 h-6", on: "translate-x-6" },
};

/**
 * 고객 화면 스위치. API 는 관리자 Toggle 과 같다 (checked · defaultChecked · onChange · size · disabled) — 제어·비제어 둘 다.
 *
 * - `role="switch"` + `aria-checked` 라 화면 읽기 프로그램이 "켬/끔" 으로 읽는다
 * - 글자가 없으니 `aria-label`(또는 aria-labelledby)을 준다. 설정 목록이면 ListRow 의 trailing 에 넣는다
 * - 눈에 보이는 트랙은 작아도 터치 영역은 사방 10px 더 넓다 (::after)
 */
const Toggle = ({
  checked,
  defaultChecked = false,
  onChange,
  size = "sm",
  disabled = false,
  className = "",
  ...props
}: ToggleProps) => {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const isOn = isControlled ? checked : internalChecked;
  const s = sizes[size];

  const handleClick = () => {
    if (disabled) return;
    if (!isControlled) setInternalChecked(!isOn);
    onChange?.(!isOn);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      disabled={disabled}
      onClick={handleClick}
      className={[
        "relative inline-flex shrink-0 items-center rounded-full transition-colors",
        "after:absolute after:-inset-2.5",
        "focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50",
        s.track,
        isOn ? "bg-primary" : "bg-line-strong",
        className,
      ].join(" ")}
      {...props}
    >
      <span
        aria-hidden="true"
        className={[
          "absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full bg-bg-card shadow-subtle transition-transform duration-150",
          s.thumb,
          isOn ? s.on : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
};

export default Toggle;
