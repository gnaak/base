import { useId, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import Field from "./field";
import { controlFrame, controlHeight, describedBy } from "./fieldStyle";

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface SelectProps extends Omit<ComponentProps<"select">, "onChange" | "value" | "size"> {
  options: SelectOption[];
  value?: string | number | null;
  /** 관리자 SelectBox 처럼 고른 옵션의 value 를 원래 타입(문자열·숫자) 그대로 넘긴다 */
  onChange?: (value: string | number) => void;
  /** 아무것도 안 골랐을 때 보이는 글자. 목록에서는 고를 수 없다 */
  placeholder?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  size?: "sm" | "md" | "lg";
  full?: boolean;
  className?: string;
}

/**
 * 고객 화면 선택 상자 — **네이티브 `<select>`** 에 모양만 입혔다. 관리자 SelectBox(직접 그린 목록)와 이름은 같다.
 *
 * 휴대폰에서는 OS 의 선택 휠·시트가 뜨는 게 가장 빠르고 접근성도 따라온다. 옵션 안에 그림·설명이 필요하면
 * RadioGroup(카드형 선택)이나 바텀시트(Modal)를 쓴다.
 */
const Select = ({
  id,
  options,
  value,
  onChange,
  placeholder = "선택하세요",
  label,
  hint,
  error,
  required,
  disabled = false,
  size = "sm",
  full = true,
  className = "",
  ...props
}: SelectProps) => {
  const autoId = useId();
  const selectId = id ?? autoId;
  const invalid = !!error;
  const empty = value === undefined || value === null || value === "";

  const handleChange = (raw: string) => {
    const picked = options.find((o) => String(o.value) === raw);
    if (picked) onChange?.(picked.value);
  };

  return (
    <Field id={selectId} label={label} hint={hint} error={error} required={required} full={full} className={className}>
      <div className={["relative flex items-center", controlHeight[size], controlFrame(invalid, disabled), full ? "w-full" : ""].join(" ")}>
        <select
          id={selectId}
          value={empty ? "" : String(value)}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy(selectId, hint, error)}
          className={[
            "w-full h-full appearance-none bg-transparent outline-none pl-3.5 pr-10 text-[16px] disabled:cursor-not-allowed",
            empty ? "text-text-placeholder" : "text-text-main",
          ].join(" ")}
          {...props}
        >
          <option value="" disabled hidden>
            {placeholder}
          </option>
          {options.map((opt) => (
            // 펼친 목록의 글자색은 select 의 색을 물려받는다 — 비어 있을 때 회색이 옵션까지 번지지 않게
            <option key={opt.value} value={String(opt.value)} disabled={opt.disabled} className="text-text-main">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 w-[18px] h-[18px] text-text-sub" aria-hidden="true" />
      </div>
    </Field>
  );
};

export default Select;
