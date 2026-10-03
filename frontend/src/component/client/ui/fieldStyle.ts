// TextField · TextArea · Select 가 같이 쓰는 것 — 라벨·오류 연결(aria)과 입력칸 테두리 · 글자 크기.

/** `field.tsx` 가 실제로 보여 주는 쪽(오류 문구 > 도움말)의 id. 없으면 undefined */
export const describedBy = (id: string, hint: unknown, error: unknown) => {
  if (error && typeof error !== "boolean") return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
};

/** 입력칸 테두리 — 포커스는 진한 2px 선(주 색, 1px 테두리 + 1px 링 — RadioGroup 의 고른 카드와 같다). 퍼지는 그림자는 없다.
 *  오류는 빨강 (포커스 중에도). 둘 다 사람이 /dev/ui 를 보고 정했다 */
export const controlFrame = (invalid: boolean, disabled: boolean) =>
  [
    "rounded-control border bg-input-bg transition-colors",
    invalid
      ? "border-point-red focus-within:ring-1 focus-within:ring-point-red"
      : "border-input-border hover:border-line-strong focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
    disabled ? "opacity-50 cursor-not-allowed" : "",
  ].join(" ");

/** 컨트롤 높이 */
export const controlHeight = {
  sm: "h-control-sm",
  md: "h-control-md",
  lg: "h-control-lg",
} as const;

/** 입력 글자 — 14px, 손가락으로 쓰는 기기만 16px. iOS 사파리는 16px 미만 입력칸에 포커스하면 화면을 확대한다 */
export const controlText = "text-[14px] [@media(pointer:coarse)]:text-[16px]";
