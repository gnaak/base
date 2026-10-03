import { useId, type ComponentProps, type ReactNode } from "react";
import Field from "./field";
import { controlFrame, describedBy } from "./fieldStyle";

interface TextAreaProps extends Omit<ComponentProps<"textarea">, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** maxLength 와 같이 주면 오른쪽 아래에 "12/200" 을 보인다 */
  showCount?: boolean;
  full?: boolean;
  className?: string;
}

/**
 * 고객 화면 여러 줄 입력 (요청 사항 · 후기 등). TextField 와 같은 라벨·도움말·오류 연결.
 * 관리자 TextareaBox 처럼 크기 조절 손잡이는 없다 — 줄 수는 `rows`(기본 4).
 */
const TextArea = ({
  id,
  value,
  onChange,
  label,
  hint,
  error,
  required,
  disabled = false,
  rows = 4,
  maxLength,
  showCount = false,
  full = true,
  className = "",
  ...props
}: TextAreaProps) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const invalid = !!error;

  return (
    <Field id={inputId} label={label} hint={hint} error={error} required={required} full={full} className={className}>
      <div className={["flex flex-col px-3.5 py-3", controlFrame(invalid, disabled), full ? "w-full" : ""].join(" ")}>
        <textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy(inputId, hint, error)}
          className="w-full resize-none bg-transparent outline-none text-[16px] leading-relaxed text-text-main placeholder:text-text-placeholder disabled:cursor-not-allowed"
          {...props}
        />
        {showCount && maxLength && (
          <span className="self-end text-[12px] tabular-nums text-text-sub" aria-hidden="true">
            {(value ?? "").length}/{maxLength}
          </span>
        )}
      </div>
    </Field>
  );
};

export default TextArea;
