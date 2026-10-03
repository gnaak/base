import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import Button, { type ButtonVariant } from "./button";
import DialogShell from "./dialogShell";
import IconButton from "./iconButton";

type Size = "sm" | "md" | "lg";
type ButtonCount = 0 | 1 | 2;

interface ModalProps {
  open: boolean;
  /** ESC · 바깥 누름 · 닫기(X) 가 부른다. 없으면 닫기(X)도 안 보인다 */
  onClose?: () => void;
  title: string;
  description?: ReactNode;
  /** 본문 — 폼 · 옵션 목록 등. 관리자 Modal 에는 없는 자리다 */
  children?: ReactNode;
  size?: Size;
  buttonCount?: ButtonCount;
  primaryText?: string;
  secondaryText?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  closeOnOverlay?: boolean;
  className?: string;
  bodyClassName?: string;
  icon?: ReactNode;
  /** 버튼이 하나일 때 한 줄을 다 쓸지. 고객 화면은 기본 true (바텀시트에서 엄지가 닿게) */
  primaryFull?: boolean;
  primaryDisabled?: boolean;
  /** 저장 중 — 확인 버튼에 스피너, 다시 못 누른다 */
  primaryLoading?: boolean;
  primaryVariant?: ButtonVariant;
}

const sizeMap: Record<Size, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

/**
 * 고객 화면 모달 — **모바일은 바텀시트, sm 이상은 가운데 창.** API 는 관리자 Modal 과 같다 (+ children · primaryLoading).
 *
 * - `document.body` 로 portal (테마는 따라온다) · ESC 로 닫힘 · 뒤 스크롤 잠금 · 포커스 가둠 — DialogShell
 * - 제목은 왼쪽 정렬 + 닫기(X). 본문(children)이 들어가는 창이라 가운데 정렬보다 읽기 쉽다.
 *   "정말 ~할까요?" 처럼 묻기만 하는 창은 ConfirmModal (가운데 아이콘 · 반반 버튼)
 * - 버튼은 반반이고 **보조가 왼쪽, 주 버튼이 오른쪽** — 관리자 ConfirmModal 과 같은 순서 (관리자 Modal 은 반대)
 *
 * @example
 * <Modal open={open} onClose={close} title="수령 방법" buttonCount={1} primaryText="선택 완료" onPrimary={save}>
 *   <RadioGroup options={...} value={v} onChange={setV} />
 * </Modal>
 */
const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  buttonCount = 2,
  primaryText = "확인",
  secondaryText = "취소",
  onPrimary,
  onSecondary,
  closeOnOverlay = true,
  className = "",
  bodyClassName = "",
  icon,
  primaryFull = true,
  primaryDisabled = false,
  primaryLoading = false,
  primaryVariant = "main",
}: ModalProps) => {
  const titleId = useId();
  const descId = useId();

  if (!open) return null;

  const handlePrimary = () => (onPrimary ? onPrimary() : onClose?.());
  const handleSecondary = () => (onSecondary ? onSecondary() : onClose?.());

  return (
    <DialogShell
      onClose={onClose}
      closeOnOverlay={closeOnOverlay}
      labelledBy={titleId}
      describedBy={description ? descId : undefined}
      widthClass={sizeMap[size]}
      className={className}
    >
      <div className="flex items-start gap-3 px-5 pt-4 sm:pt-6">
        {icon && (
          <div className="mt-0.5 w-10 h-10 shrink-0 rounded-full bg-bg-sub flex items-center justify-center text-text-sub [&_svg]:w-5 [&_svg]:h-5">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0 pt-1.5">
          <h2 id={titleId} className="text-[18px] font-semibold leading-snug tracking-tight text-text-main">
            {title}
          </h2>
          {description && (
            <div id={descId} className="mt-1.5 text-[14px] leading-relaxed text-text-sub whitespace-pre-wrap">
              {description}
            </div>
          )}
        </div>
        {onClose && <IconButton icon={<X />} label="닫기" size="md" className="-mr-2 shrink-0" onClick={onClose} />}
      </div>

      {children && <div className={["px-5 pt-4", bodyClassName].join(" ")}>{children}</div>}

      {buttonCount > 0 ? (
        <div className={["flex gap-2 px-5 pt-6 pb-5 sm:pb-6", buttonCount === 1 && !primaryFull ? "justify-center" : ""].join(" ")}>
          {buttonCount === 2 && (
            <Button variant="sub1" full className="flex-1" onClick={handleSecondary}>
              {secondaryText}
            </Button>
          )}
          <Button
            variant={primaryVariant}
            full={buttonCount === 2 || primaryFull}
            className={buttonCount === 2 || primaryFull ? "flex-1" : ""}
            onClick={handlePrimary}
            disabled={primaryDisabled}
            loading={primaryLoading}
          >
            {primaryText}
          </Button>
        </div>
      ) : (
        <div className="pb-5 sm:pb-6" />
      )}
    </DialogShell>
  );
};

export default Modal;
