import { useId, type ComponentProps, type ReactNode } from "react";
import Field from "./field";
import { controlFrame, controlHeight, describedBy } from "./fieldStyle";

type Size = "sm" | "md" | "lg";
type InputType = "text" | "password" | "email" | "number" | "tel" | "url" | "search";

interface TextFieldProps extends Omit<ComponentProps<"input">, "onChange" | "size" | "value" | "type"> {
  value?: string;
  /** 관리자 InputBox 처럼 이벤트가 아니라 값을 넘긴다 */
  onChange?: (value: string) => void;
  type?: InputType;
  label?: ReactNode;
  /** 입력칸 아래 회색 도움말. 오류가 있으면 오류가 이 자리를 대신한다 */
  hint?: ReactNode;
  /** 문자열이면 빨간 오류 문구 + aria-invalid. true 면 문구 없이 표시만 */
  error?: ReactNode;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  full?: boolean;
  /** 바깥 묶음(라벨 포함)에 붙는다 */
  className?: string;
}

/**
 * 고객 화면 한 줄 입력. 관리자 InputBox 와 같은 이름(value · onChange(value) · size · leftIcon · rightIcon · full · error)
 * 에 라벨 · 도움말 · 필수 표시와 접근성 연결을 더했다.
 *
 * - 라벨은 `<label htmlFor>` 로, 도움말·오류는 `aria-describedby` 로 입력칸에 연결된다 (id 를 안 주면 useId)
 * - 오류면 `aria-invalid` — 화면 읽기 프로그램이 "잘못됨" 을 읽는다
 * - 글자는 16px 고정 — iOS 사파리가 16px 미만 입력칸에서 화면을 확대한다
 * - 그 밖의 input 속성(name · autoComplete · inputMode · maxLength · ref …)은 그대로 넘어간다
 */
const TextField = ({
  id,
  value,
  onChange,
  type = "text",
  label,
  hint,
  error,
  required,
  disabled = false,
  size = "sm",
  leftIcon,
  rightIcon,
  full = true,
  className = "",
  ...props
}: TextFieldProps) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const invalid = !!error;

  return (
    <Field id={inputId} label={label} hint={hint} error={error} required={required} full={full} className={className}>
      <div
        className={[
          "flex items-center gap-2 px-3.5",
          controlHeight[size],
          controlFrame(invalid, disabled),
          full ? "w-full" : "",
        ].join(" ")}
      >
        {leftIcon && (
          <span className="flex shrink-0 text-text-sub [&_svg]:w-[18px] [&_svg]:h-[18px]">{leftIcon}</span>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy(inputId, hint, error)}
          className="flex-1 min-w-0 h-full bg-transparent outline-none text-[16px] text-text-main placeholder:text-text-placeholder disabled:cursor-not-allowed"
          {...props}
        />
        {rightIcon && (
          <span className="flex shrink-0 text-text-sub [&_svg]:w-[18px] [&_svg]:h-[18px]">{rightIcon}</span>
        )}
      </div>
    </Field>
  );
};

export default TextField;
