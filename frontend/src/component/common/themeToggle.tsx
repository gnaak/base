import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/common/useTheme";
import { type ResolvedTheme } from "@/types/theme";

const OPTIONS: { value: ResolvedTheme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "라이트 모드", Icon: Sun },
  { value: "dark", label: "다크 모드", Icon: Moon },
];

/**
 * 라이트 / 다크 두 칸짜리 토글. 지금 적용된 쪽(`resolved`)이 눌린 채로 보인다.
 *
 * 처음엔 OS 설정을 따라가고(ThemeProvider 의 `system`), 한 번 고르면 그 값이 localStorage 에 남는다.
 * "시스템" 칸은 일부러 없다 — 화면에 보이는 건 라이트·다크 둘뿐이라 세 번째 상태가 헷갈린다.
 */
const ThemeToggle = () => {
  const { resolved, setPreference } = useTheme();

  return (
    <div role="group" aria-label="화면 테마" className="inline-flex items-center gap-0.5 p-0.5 rounded-full shadow-border">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = resolved === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            aria-label={label}
            aria-pressed={active}
            title={label}
            className={[
              "inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-150",
              active ? "bg-bg-active text-text-main" : "text-text-sub hover:text-text-main",
            ].join(" ")}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
