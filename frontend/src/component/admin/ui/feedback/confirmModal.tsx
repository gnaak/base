import { useEffect, type ReactNode } from "react";
import { AlertTriangle, Info, X } from "lucide-react";

type Variant = "default" | "warning" | "danger";

interface ConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  variant?: Variant;
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
    iconWrap: "bg-bg-sub text-text-sub",
    icon: <Info className="w-5 h-5" />,
    confirm:
      "bg-primary text-text-inverse hover:bg-primary/90 active:bg-primary-dark",
  },
  warning: {
    iconWrap: "bg-warning-bg text-point-amber",
    icon: <AlertTriangle className="w-5 h-5" />,
    confirm:
      "bg-point-amber text-text-inverse hover:bg-point-amber/90 active:bg-point-amber",
  },
  danger: {
    iconWrap: "bg-error-bg text-point-red",
    icon: <AlertTriangle className="w-5 h-5" />,
    confirm:
      "bg-point-red text-text-inverse hover:bg-point-red/90 active:bg-point-red",
  },
};

const sizeMap: Record<NonNullable<ConfirmModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

const ConfirmModal = ({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  variant = "default",
  confirmLabel = "확인",
  cancelLabel = "취소",
  confirmDisabled = false,
  hideCancel = false,
  size = "md",
}: ConfirmModalProps) => {
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

  return (
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
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 pb-4">
          <div
            className={[
              "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
              style.iconWrap,
            ].join(" ")}
          >
            {style.icon}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-text-main">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="닫기"
            className="
              shrink-0 -mr-1 -mt-1 w-7 h-7 rounded-lg
              flex items-center justify-center
              text-text-disabled hover:text-text-sub hover:bg-bg-hover
              transition-colors
            "
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {description && (
          <div className="px-5 pb-5 text-[13px] leading-relaxed text-text-sub flex flex-col gap-3">
            {description}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line bg-bg-sub/60 rounded-b-2xl">
          {!hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="
                inline-flex items-center justify-center h-9 px-4 rounded-lg
                text-[13px] font-medium text-text-sub
                hover:bg-bg-active/70 active:bg-bg-active
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
              "inline-flex items-center justify-center h-9 px-4 rounded-lg",
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
    </div>
  );
};

export default ConfirmModal;
