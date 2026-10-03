import type { ReactNode } from "react";

interface FieldProps {
  /** 컨트롤의 id — 라벨(htmlFor)과 도움말 id(`{id}-hint` · `{id}-error`)가 여기서 나온다 */
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  /** 문자열이면 도움말 대신 빨간 글자로 보인다. true 면 표시 없이 테두리만 빨갛다 */
  error?: ReactNode;
  required?: boolean;
  full?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * 라벨 · 컨트롤 · 도움말/오류 한 묶음. TextField · TextArea · Select 가 같이 쓴다 (고객 화면 킷 내부용).
 *
 * 오류가 있으면 도움말 자리를 오류가 대신한다 — 컨트롤의 aria-describedby 도 그 하나만 가리킨다 (`fieldStyle.ts` 의 describedBy).
 */
const Field = ({ id, label, hint, error, required, full = true, className = "", children }: FieldProps) => {
  const errorText = typeof error === "boolean" ? null : error;

  return (
    <div className={["flex flex-col gap-1.5 font-client", full ? "w-full" : "", className].join(" ")}>
      {label && (
        <label htmlFor={id} className="text-[14px] font-medium tracking-tight text-text-main">
          {label}
          {required && (
            <span className="ml-0.5 text-point-red" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {errorText ? (
        <p id={`${id}-error`} className="text-[13px] leading-snug text-point-red">
          {errorText}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-[13px] leading-snug text-text-sub">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

export default Field;
