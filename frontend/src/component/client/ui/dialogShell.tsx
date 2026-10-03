import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useScrollLock } from "@/hooks/common/useScrollLock";
import ThemePortal from "./themePortal";

// 겹쳐 열린 창 순서 — ESC 는 맨 위 하나만 닫는다 (모달 위에 확인 창을 띄운 경우)
const openStack: string[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogShellProps {
  onClose?: () => void;
  closeOnOverlay?: boolean;
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  describedBy?: string;
  /** sm 이상에서의 최대 폭 (예: "sm:max-w-md") */
  widthClass: string;
  className?: string;
  children: ReactNode;
}

/**
 * Modal · ConfirmModal 의 껍데기 (고객 화면 킷 내부용). **열려 있을 때만 그린다** — 부모가 `open` 으로 거른다.
 *
 * - 모바일(sm 미만)은 아래에서 올라오는 **바텀시트**, sm 이상은 가운데 창. 시트 아래는 홈 인디케이터만큼 띄운다
 * - `document.body` 로 portal 하면서 테마를 같이 옮긴다 (ThemePortal)
 * - ESC 로 닫힘 · 뒤 페이지 스크롤 잠금 · 열리면 창으로 포커스, Tab 은 창 안에서만 돌고, 닫히면 원래 자리로 돌아간다
 * - 바깥(어두운 면)을 눌러 닫기 — 창 안에서 누르고 밖에서 뗀 드래그는 닫지 않는다
 */
const DialogShell = ({
  onClose,
  closeOnOverlay = true,
  role = "dialog",
  labelledBy,
  describedBy,
  widthClass,
  className = "",
  children,
}: DialogShellProps) => {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const mouseDownOnOverlay = useRef(false);
  // 핸들러는 렌더마다 바뀔 수 있어 ref 로 최신 값을 본다 (effect 를 다시 걸면 포커스가 튄다)
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useScrollLock(true);

  useEffect(() => {
    openStack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && openStack[openStack.length - 1] === id) onCloseRef.current?.();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      openStack.splice(openStack.indexOf(id), 1);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [id]);

  const handleTrapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleOverlayMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlay && mouseDownOnOverlay.current && e.target === e.currentTarget) onClose?.();
  };

  return (
    <ThemePortal>
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 bg-overlay/40 animate-fade-in motion-reduce:animate-none"
        onMouseDown={handleOverlayMouseDown}
        onClick={handleOverlayClick}
      >
        <div
          ref={panelRef}
          role={role}
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          tabIndex={-1}
          onKeyDown={handleTrapTab}
          className={[
            "relative w-full max-h-[92svh] overflow-y-auto flex flex-col outline-none",
            "bg-bg-card text-text-main font-client shadow-2xl ring-1 ring-line",
            "rounded-t-sheet sm:rounded-sheet pb-[env(safe-area-inset-bottom)] sm:pb-0",
            "animate-sheet-up sm:animate-fade-slide motion-reduce:animate-none",
            widthClass,
            className,
          ].join(" ")}
        >
          {/* 바텀시트 손잡이 (모양만 — 끌어서 닫기는 없다) */}
          <div className="sm:hidden mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
          {children}
        </div>
      </div>
    </ThemePortal>
  );
};

export default DialogShell;
