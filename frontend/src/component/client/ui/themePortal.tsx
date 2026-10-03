import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ThemeScope {
  theme?: string;
  vars: Record<string, string>;
}

/**
 * `document.body` 로 portal 하면서 고객 화면 테마를 같이 들고 간다. Modal · ConfirmModal · Toast 가 쓴다.
 *
 * - body 로 보내는 이유: sticky·transform 부모 안에서 그리면 쌓임 맥락에 갇혀 뒤 형제가 모달을 덮는다
 *   (관리자 사이드바의 로그아웃 확인이 실제로 그랬다 — frontend/CLAUDE.md)
 * - 그런데 body 는 `.theme-client` 밖이라 테마 변수(색·모양·글꼴)가 끊긴다. 그래서 제자리에 둔 표식으로
 *   가장 가까운 `.theme-client` 를 찾아 `data-theme` 와 인라인 `--*` 변수를 portal 감싸개에 그대로 옮긴다
 * - 테마는 열릴 때 한 번 읽는다 (열린 채 테마를 바꾸는 건 /dev/ui 미리보기뿐이다)
 */
const ThemePortal = ({ children }: { children: ReactNode }) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [scope, setScope] = useState<ThemeScope | null>(null);

  // 그리기 전에 읽어서 첫 프레임부터 테마 색으로 보이게 한다
  useLayoutEffect(() => {
    const host = anchorRef.current?.closest<HTMLElement>(".theme-client");
    if (!host) return;
    const vars: Record<string, string> = {};
    for (let i = 0; i < host.style.length; i += 1) {
      const name = host.style.item(i);
      if (name.startsWith("--")) vars[name] = host.style.getPropertyValue(name);
    }
    setScope({ theme: host.dataset.theme, vars });
  }, []);

  return (
    <>
      <span ref={anchorRef} hidden />
      {createPortal(
        // body 의 글자색은 :root 값으로 계산돼 내려오므로 여기서 테마 값으로 다시 잡는다
        <div
          className={scope ? "theme-client text-text-main" : "text-text-main"}
          data-theme={scope?.theme}
          style={scope?.vars as CSSProperties | undefined}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
};

export default ThemePortal;
