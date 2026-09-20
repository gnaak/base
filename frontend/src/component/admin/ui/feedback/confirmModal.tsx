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
    iconWrap: "bg-neutral-100 text-neutral-700",
    icon: <Info className="w-5 h-5" />,
    confirm:
      "bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-950",
  },
  warning: {
    iconWrap: "bg-amber-100 text-amber-700",
    icon: <AlertTriangle className="w-5 h-5" />,
    confirm:
      "bg-amber-600 text-white hover:bg-amber-500 active:bg-amber-700",
  },
  danger: {
    iconWrap: "bg-red-100 text-red-700",
    icon: <AlertTriangle className="w-5 h-5" />,
    confirm: "bg-red-600 text-white hover:bg-red-500 active:bg-red-700",
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 animate-[fadeIn_120ms_ease-out]"
      onClick={onCancel}
    >
      <div
        className={[
          "w-full rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200",
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
            <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
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
              text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100
              transition-colors
            "
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {description && (
          <div className="px-5 pb-5 text-[13px] leading-relaxed text-neutral-600 flex flex-col gap-3">
            {description}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-neutral-100 bg-neutral-50/60 rounded-b-2xl">
          {!hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="
                inline-flex items-center justify-center h-9 px-4 rounded-lg
                text-[13px] font-medium text-neutral-700
                hover:bg-neutral-200/70 active:bg-neutral-200
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
