import { useEffect, useLayoutEffect, useRef } from "react";
import { AlertCircle, CheckCircle, Info, TriangleAlert, X } from "lucide-react";
import ThemePortal from "./themePortal";

type ToastType = "info" | "success" | "warning" | "error";

interface ToastProps {
  open: boolean;
  onClose: () => void;
  type?: ToastType;
  title?: string;
  description?: string;
  /** 자동으로 닫히기까지(ms). 0 이면 직접 닫을 때까지 남는다 */
  duration?: number;
  closable?: boolean;
  className?: string;
}

const colors: Record<ToastType, string> = {
  info: "bg-info-bg border-point-blue/20",
  success: "bg-success-bg border-point-green/20",
  warning: "bg-warning-bg border-point-amber/30",
  error: "bg-error-bg border-point-red/20",
};

// 상태색은 아이콘에만 — 관리자 Toast 와 같은 규칙 (작은 글자를 point 색으로 칠하면 옅은 면 위에서 잘 안 읽힌다)
const icons: Record<ToastType, { Icon: typeof Info; color: string }> = {
  info: { Icon: Info, color: "text-point-blue" },
  success: { Icon: CheckCircle, color: "text-point-green" },
  warning: { Icon: TriangleAlert, color: "text-point-amber" },
  error: { Icon: AlertCircle, color: "text-point-red" },
};

/**
 * 고객 화면 토스트 — **관리자 Toast 와 같은 API**(open · onClose · type · title · description · duration · closable)라
 * 쓰는 법이 같다. 관리자 것을 그대로 쓰지 않은 이유: body 로 portal 하며 테마를 들고 가야 하고(ThemePortal),
 * 노치(safe-area) 아래에 떠야 하고, 모서리·글꼴이 테마 토큰을 따라야 해서다.
 *
 * - 화면 위 가운데 (하단 탭 · 바텀시트 버튼과 겹치지 않게)
 * - 오류는 `role="alert"`(바로 읽힘), 나머지는 `role="status"`(하던 말이 끝나고 읽힘)
 */
const Toast = ({
  open,
  onClose,
  type = "info",
  title,
  description,
  duration = 4000,
  closable = true,
  className = "",
}: ToastProps) => {
  // onClose 를 인라인 화살표로 넘겨도 부모가 다시 그릴 때마다 타이머가 처음부터 돌지 않게 ref 로 본다
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !duration || duration <= 0) return;
    const timer = window.setTimeout(() => onCloseRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [open, duration]);

  if (!open) return null;

  const { Icon, color } = icons[type];

  return (
    <ThemePortal>
      <div
        className={[
          "fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[110] flex justify-center px-4 pointer-events-none",
          className,
        ].join(" ")}
      >
        <div
          role={type === "error" ? "alert" : "status"}
          className={[
            "pointer-events-auto w-full max-w-sm flex gap-3 px-4 py-3 rounded-card border shadow-md font-client text-text-main",
            "animate-fade-slide motion-reduce:animate-none",
            description ? "items-start" : "items-center",
            colors[type],
          ].join(" ")}
        >
          <Icon className={["w-[18px] h-[18px] shrink-0", description ? "mt-px" : "", color].join(" ")} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            {title && <p className="text-[14px] font-medium">{title}</p>}
            {description && <p className="mt-0.5 text-[13px] leading-relaxed text-text-sub">{description}</p>}
          </div>
          {closable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="알림 닫기"
              className="-m-1 p-1.5 shrink-0 rounded-control text-text-sub hover:text-text-main hover:bg-text-main/10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </ThemePortal>
  );
};

export default Toast;
