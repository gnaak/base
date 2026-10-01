import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info } from "lucide-react";

type Variant = "default" | "warning" | "danger";

interface ConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  /** 두 문장이면 `<br />` 로 직접 끊는다 — 자동 줄바꿈은 문장 중간에서 끊긴다 */
  description?: ReactNode;
  variant?: Variant;
  /** variant 기본 아이콘 대신 쓸 아이콘 (예: 로그아웃이면 `<LogOut />`) — 색·크기는 variant 가 입힌다 */
  icon?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  hideCancel?: boolean;
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<
  Variant,
  {
    iconWrap: string;
    icon: ReactNode;
    confirm: string;
  }
> = {
  default: {
    iconWrap: "bg-bg-sub text-text-sub ring-bg-sub/50",
    icon: <Info />,
    confirm:
      "bg-primary text-text-inverse hover:bg-primary/90 active:bg-primary-dark",
  },
  warning: {
    iconWrap: "bg-warning-bg text-point-amber ring-warning-bg/50",
    icon: <AlertTriangle />,
    confirm:
      "bg-point-amber text-text-inverse hover:bg-point-amber/90 active:bg-point-amber",
  },
  danger: {
    iconWrap: "bg-error-bg text-point-red ring-error-bg/50",
    icon: <AlertTriangle />,
    confirm:
      "bg-point-red text-text-inverse hover:bg-point-red/90 active:bg-point-red",
  },
};

// 가운데 정렬이라 넓으면 줄이 길게 늘어진다 — 확인 모달은 다른 모달보다 한 단계씩 좁다
const sizeMap: Record<NonNullable<ConfirmModalProps["size"]>, string> = {
  sm: "max-w-[320px]",
  md: "max-w-sm",
  lg: "max-w-md",
};

const ConfirmModal = ({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  variant = "default",
  icon,
  confirmLabel = "확인",
  cancelLabel = "취소",
  confirmDisabled = false,
  hideCancel = false,
  size = "md",
}: ConfirmModalProps) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  const style = variantStyles[variant];

  // body 로 portal 한다 — 부모가 sticky·transform 이면 쌓임 맥락에 갇혀 z-index 가 안 먹고,
  // 뒤에 오는 형제(<main>)가 모달 위로 그려져 버튼이 안 눌린다 (사이드바의 로그아웃 확인이 그랬다)
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay/40 backdrop-blur-sm px-4 animate-[fadeIn_120ms_ease-out]"
      onClick={onCancel}
    >
      <div
        className={[
          "w-full rounded-2xl bg-bg-card shadow-2xl ring-1 ring-line",
          "flex flex-col",
          "animate-[popIn_140ms_ease-out]",
          sizeMap[size],
        ].join(" ")}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center px-6 pt-7 pb-5">
          <div
            className={[
              "w-12 h-12 rounded-full flex items-center justify-center ring-8 [&_svg]:w-[22px] [&_svg]:h-[22px]",
              style.iconWrap,
            ].join(" ")}
          >
            {icon ?? style.icon}
          </div>
          <h2 id={titleId} className="mt-5 text-[16px] font-semibold tracking-tight text-text-main">
            {title}
          </h2>
          {description && (
            <div className="mt-2 text-[13px] leading-relaxed text-text-sub flex flex-col gap-3">
              {description}
            </div>
          )}
        </div>

        {/* 버튼은 반반 — 취소를 숨기면 확인이 한 줄을 다 쓴다 */}
        <div className="flex gap-2 px-6 pb-6">
          {!hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="
                flex-1 inline-flex items-center justify-center h-10 rounded-lg
                text-[13px] font-medium text-text-main
                bg-bg-card shadow-border hover:bg-bg-hover active:bg-bg-active
                transition-colors
              "
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={[
              "flex-1 inline-flex items-center justify-center h-10 rounded-lg",
              "text-[13px] font-medium transition-colors",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              style.confirm,
            ].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default ConfirmModal;
