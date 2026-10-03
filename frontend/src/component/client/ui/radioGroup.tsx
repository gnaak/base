import { useId, type ReactNode } from "react";

export interface RadioOption {
  value: string | number;
  label: ReactNode;
  /** 라벨 아래 회색 한 줄 (예: "내일 새벽 도착") */
  description?: ReactNode;
  /** 오른쪽 끝 (가격 · 뱃지 등) */
  trailing?: ReactNode;
  disabled?: boolean;
}

interface RadioGroupProps {
  options: RadioOption[];
  value?: string | number | null;
  onChange?: (value: string | number) => void;
  /** 묶음 제목 — `<legend>` 라 화면 읽기 프로그램이 각 선택지 앞에 읽는다 */
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** 폼 제출 이름. 안 주면 자동으로 만든다 (같은 name 이어야 방향키로 옮겨 다닌다) */
  name?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 고객 화면 단일 선택 — **카드형 선택지** (결제 수단 · 배송 옵션 · 요금제). 관리자 RadioButton 의 고객 화면 짝이다.
 *
 * 제어 컴포넌트다 (value + onChange). 고른 카드는 주 색 2px 링으로 표시한다.
 * 선택지가 많고 설명이 없으면 Select 가 낫다.
 */
const RadioGroup = ({
  options,
  value,
  onChange,
  label,
  hint,
  error,
  name,
  disabled = false,
  className = "",
}: RadioGroupProps) => {
  const autoId = useId();
  const groupName = name ?? autoId;
  const errorText = typeof error === "boolean" ? null : error;
  const messageId = errorText ? `${autoId}-error` : hint ? `${autoId}-hint` : undefined;

  return (
    <fieldset
      className={["flex flex-col gap-2 min-w-0 font-client", className].join(" ")}
      disabled={disabled}
      aria-describedby={messageId}
    >
      {label && <legend className="mb-1.5 text-[14px] font-medium tracking-tight text-text-main">{label}</legend>}
      {options.map((opt) => {
        const selected = value === opt.value;
        const off = disabled || opt.disabled;
        return (
          <label
            key={opt.value}
            className={[
              "flex items-center gap-3 min-h-control-lg px-4 py-3 rounded-control bg-bg-card transition-shadow",
              selected ? "ring-2 ring-primary" : error ? "ring-1 ring-point-red" : "shadow-border",
              off ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-bg-hover",
            ].join(" ")}
          >
            <input
              type="radio"
              name={groupName}
              value={String(opt.value)}
              checked={selected}
              disabled={opt.disabled}
              onChange={() => onChange?.(opt.value)}
              className="m-0 w-5 h-5 shrink-0 appearance-none rounded-full border border-line-strong bg-input-bg transition-all checked:border-[6px] checked:border-primary focus-visible:outline-none focus-visible:shadow-focus"
            />
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[15px] font-medium text-text-main">{opt.label}</span>
              {opt.description && <span className="text-[13px] text-text-sub">{opt.description}</span>}
            </span>
            {opt.trailing && <span className="shrink-0 text-[14px] text-text-main">{opt.trailing}</span>}
          </label>
        );
      })}
      {errorText ? (
        <p id={`${autoId}-error`} className="text-[13px] leading-snug text-point-red">
          {errorText}
        </p>
      ) : (
        hint && (
          <p id={`${autoId}-hint`} className="text-[13px] leading-snug text-text-sub">
            {hint}
          </p>
        )
      )}
    </fieldset>
  );
};

export default RadioGroup;
