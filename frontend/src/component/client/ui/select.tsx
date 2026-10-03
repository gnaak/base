import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import Field from "./field";
import { controlFrame, controlHeight, controlText, describedBy } from "./fieldStyle";
import ThemePortal from "./themePortal";

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface SelectProps {
  id?: string;
  /** 폼으로 보낼 때의 이름 — 숨은 input 으로 값을 같이 싣는다 */
  name?: string;
  options: SelectOption[];
  value?: string | number | null;
  /** 관리자 SelectBox 처럼 고른 옵션의 value 를 원래 타입(문자열·숫자) 그대로 넘긴다 */
  onChange?: (value: string | number) => void;
  /** 아무것도 안 골랐을 때 보이는 글자. 목록에서는 고를 수 없다 */
  placeholder?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  full?: boolean;
  className?: string;
}

/**
 * 고객 화면 선택 상자 — 펼친 목록까지 직접 그린다 (둥근 모서리 · 테마 토큰). 관리자 SelectBox 와 이름이 같다.
 *
 * 예전에는 네이티브 `<select>` 였는데, 펼친 목록은 OS 가 그려서 모서리 · 색을 바꿀 수 없었다 (사람이 보고 "둥글게").
 * 접근성은 combobox + listbox 패턴 — ↑↓ · Home/End · Enter/Space · Esc · Tab. 포커스는 버튼에 남고
 * 지금 가리키는 옵션은 aria-activedescendant 로 알린다. 옵션 안에 그림 · 설명이 필요하면 RadioGroup 이나 Modal.
 *
 * 목록은 body 로 portal 해서 버튼 위치에 fixed 로 띄운다 — 모달 판처럼 넘치면 잘라 내는(overflow) 부모 안에서도
 * 안 잘린다 (처음엔 absolute 였는데 /dev/ui 의 입력 모달에서 판 끝에 잘렸다). 아래 공간이 모자라면 위로 펼친다.
 * z-index 는 모달(100) 위 · 토스트(110) 아래.
 */
const Select = ({
  id,
  name,
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
}: SelectProps) => {
  const autoId = useId();
  const selectId = id ?? autoId;
  const listId = `${selectId}-list`;
  const invalid = !!error;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  const enabled = options.flatMap((o, i) => (o.disabled ? [] : [i]));

  // 버튼 자리에 붙인다 — 스크롤 · 창 크기가 바뀌면 다시
  const measure = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const up = below < 240 && rect.top > below;
    setPlace(
      up
        ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 6 }
        : { left: rect.left, width: rect.width, top: rect.bottom + 6 },
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true); // 모달 판 같은 안쪽 스크롤까지
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  // 바깥을 누르면 닫는다 (목록은 portal 이라 버튼 묶음 밖에 있다)
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // 키보드로 옮기면 그 옵션이 보이게
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, listId]);

  const openList = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : (enabled[0] ?? -1));
    setOpen(true);
  };

  const move = (step: 1 | -1) => {
    if (!enabled.length) return;
    const at = enabled.indexOf(active);
    if (at === -1) setActive(step === 1 ? enabled[0] : enabled[enabled.length - 1]);
    else setActive(enabled[(at + step + enabled.length) % enabled.length]);
  };

  const pick = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange?.(option.value);
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (open) move(e.key === "ArrowDown" ? 1 : -1);
        else openList();
        break;
      case "Home":
      case "End":
        if (!open) break;
        e.preventDefault();
        setActive(e.key === "Home" ? (enabled[0] ?? -1) : (enabled[enabled.length - 1] ?? -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) pick(active);
        else openList();
        break;
      case "Escape":
        if (!open) break;
        // 모달 안이면 목록만 닫고 모달은 둔다 (모달의 Esc 는 document 에서 듣는다)
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <Field id={selectId} label={label} hint={hint} error={error} required={required} full={full} className={className}>
      <div ref={rootRef} className={["relative", full ? "w-full" : ""].join(" ")}>
        <button
          ref={buttonRef}
          type="button"
          id={selectId}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy(selectId, hint, error)}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={handleKeyDown}
          className={[
            "flex w-full items-center justify-between gap-2 pl-3 pr-2.5 text-left outline-none",
            controlHeight[size],
            controlText,
            controlFrame(invalid, disabled),
            open && !invalid ? "border-primary ring-1 ring-primary" : "",
          ].join(" ")}
        >
          <span className={["truncate", selected ? "text-text-main" : "text-text-placeholder"].join(" ")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            className={["h-4 w-4 shrink-0 text-text-sub transition-transform", open ? "rotate-180" : ""].join(" ")}
            aria-hidden="true"
          />
        </button>
        {name && <input type="hidden" name={name} value={value ?? ""} />}

        {open && (
          <ThemePortal>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              style={place ?? undefined}
              className="fixed z-[105] max-h-64 overflow-auto rounded-card bg-bg-card p-1 font-client shadow-card dark:shadow-card-dark animate-fade-in"
            >
              {options.map((option, i) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    // 누르는 순간 버튼에서 포커스가 빠지지 않게 — 키보드 · 스크린리더가 계속 버튼을 본다
                    onPointerDown={(e) => e.preventDefault()}
                    onPointerMove={() => !option.disabled && setActive(i)}
                    onClick={() => pick(i)}
                    className={[
                      "flex items-center justify-between gap-2 rounded-control px-2.5 py-2",
                      controlText,
                      option.disabled ? "cursor-not-allowed text-text-disabled" : "cursor-pointer text-text-main",
                      i === active ? "bg-bg-hover" : "",
                      isSelected ? "font-medium" : "",
                    ].join(" ")}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
          </ThemePortal>
        )}
      </div>
    </Field>
  );
};

export default Select;
