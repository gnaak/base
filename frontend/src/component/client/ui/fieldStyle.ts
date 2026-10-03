// TextField · TextArea · Select 가 같이 쓰는 것 — 라벨·오류 연결(aria)과 입력칸 테두리.

/** `field.tsx` 가 실제로 보여 주는 쪽(오류 문구 > 도움말)의 id. 없으면 undefined */
export const describedBy = (id: string, hint: unknown, error: unknown) => {
  if (error && typeof error !== "boolean") return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
};

/** 입력칸 테두리 — 포커스는 파란 테두리 + 옅은 링, 오류는 빨강 (포커스 중에도) */
export const controlFrame = (invalid: boolean, disabled: boolean) =>
  [
    "rounded-control border bg-input-bg transition-colors",
    invalid
      ? "border-point-red focus-within:ring-[3px] focus-within:ring-point-red/20"
      : "border-input-border hover:border-line-strong focus-within:border-line-focus focus-within:ring-[3px] focus-within:ring-line-focus/20",
    disabled ? "opacity-50 cursor-not-allowed" : "",
  ].join(" ");

/** 컨트롤 높이 — 글자는 크기와 상관없이 16px. iOS 사파리는 16px 미만 입력칸에 포커스하면 화면을 확대한다 */
export const controlHeight = {
  sm: "h-control-sm",
  md: "h-control-md",
  lg: "h-control-lg",
} as const;
