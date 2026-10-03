import { useId, type ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import Button from "./button";
import DialogShell from "./dialogShell";

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
  /** 처리 중 — 확인 버튼에 스피너, 다시 못 누른다 (고객 화면에만 있다) */
  confirmLoading?: boolean;
  hideCancel?: boolean;
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<Variant, { iconWrap: string; icon: ReactNode; confirm: "main" | "danger" }> = {
  default: { iconWrap: "bg-bg-sub text-text-sub ring-bg-sub/50", icon: <Info />, confirm: "main" },
  // 경고 톤은 아이콘이 맡고 버튼은 주 색 — 고객 Button 에는 amber 버튼이 없다 (관리자는 amber 버튼)
  warning: { iconWrap: "bg-warning-bg text-point-amber ring-warning-bg/50", icon: <AlertTriangle />, confirm: "main" },
  danger: { iconWrap: "bg-error-bg text-point-red ring-error-bg/50", icon: <AlertTriangle />, confirm: "danger" },
};

// 가운데 정렬이라 넓으면 줄이 길게 늘어진다 — 확인 창은 Modal 보다 한 단계씩 좁다 (관리자와 같은 폭)
const sizeMap: Record<NonNullable<ConfirmModalProps["size"]>, string> = {
  sm: "sm:max-w-[320px]",
  md: "sm:max-w-sm",
  lg: "sm:max-w-md",
};

/**
 * 고객 화면 확인 창 — 관리자 ConfirmModal 과 같은 API · 같은 디자인(가운데 아이콘 → 제목 → 설명, 버튼은 반반,
 * 취소가 왼쪽). 다른 점: 모바일에서는 바텀시트로 올라오고, 버튼은 고객 Button(44px · 테마 모양), `confirmLoading`.
 *
 * @example
 * <ConfirmModal open={open} variant="danger" title="주문을 취소할까요?" description="결제 금액은 3영업일 안에 돌아가요."
 *               confirmLabel="주문 취소" onConfirm={handleCancelOrder} onCancel={() => setOpen(false)} />
 */
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
  confirmLoading = false,
  hideCancel = false,
  size = "md",
}: ConfirmModalProps) => {
  const titleId = useId();
  const descId = useId();

  if (!open) return null;

  const style = variantStyles[variant];

  return (
    <DialogShell
      role="alertdialog"
      onClose={onCancel}
      labelledBy={titleId}
      describedBy={description ? descId : undefined}
      widthClass={sizeMap[size]}
    >
      <div className="flex flex-col items-center text-center px-6 pt-6 sm:pt-7 pb-5">
        <div
          className={[
            "w-12 h-12 rounded-full flex items-center justify-center ring-8 [&_svg]:w-[22px] [&_svg]:h-[22px]",
            style.iconWrap,
          ].join(" ")}
        >
          {icon ?? style.icon}
        </div>
        <h2 id={titleId} className="mt-5 text-[17px] font-semibold tracking-tight text-text-main">
          {title}
        </h2>
        {description && (
          <div id={descId} className="mt-2 text-[14px] leading-relaxed text-text-sub flex flex-col gap-3">
            {description}
          </div>
        )}
      </div>

      {/* 버튼은 반반 — 취소를 숨기면 확인이 한 줄을 다 쓴다 */}
      <div className="flex gap-2 px-6 pb-6">
        {!hideCancel && (
          <Button variant="sub1" full className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button
          variant={style.confirm}
          full
          className="flex-1"
          onClick={onConfirm}
          disabled={confirmDisabled}
          loading={confirmLoading}
        >
          {confirmLabel}
        </Button>
      </div>
    </DialogShell>
  );
};

export default ConfirmModal;
