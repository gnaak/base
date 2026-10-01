// src/context/ThemeProvider.tsx

import { useCallback, useEffect, useRef, useState, ReactNode } from "react";
import { THEME_STORAGE_KEY, ThemeContext } from "@/hooks/common/useTheme";
import { ResolvedTheme, ThemePreference } from "@/types/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

const readPreference = (): ThemePreference => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    // 사파리 비공개 모드 등에서 localStorage 접근이 throw 한다
    return "system";
  }
};

const systemPrefersDark = () =>
  typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;

const resolve = (preference: ThemePreference): ResolvedTheme =>
  preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;

const nextFrame = (fn: () => void) =>
  typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame(fn)
    : window.setTimeout(fn, 16);

/**
 * `<html>` 에 `.dark` 를 붙이고 뗀다. tailwind `darkMode: "class"` 와 index.css 의 `.dark { … }` 토큰이 이걸 본다.
 * 전환 순간에는 `theme-switching` 을 2프레임 동안 붙여 transition 을 끈다 —
 * 요소마다 색이 제각각 페이드되며 화면이 번쩍이는 걸 막는다 (index.css 맨 아래).
 */
const applyTheme = (theme: ResolvedTheme, animate: boolean) => {
  const root = document.documentElement;
  if (animate) root.classList.add("theme-switching");
  root.classList.toggle("dark", theme === "dark");
  if (animate) nextFrame(() => nextFrame(() => root.classList.remove("theme-switching")));
};

/**
 * 라이트/다크 테마를 전역 Context 로 제공한다. 기본은 `system`(OS 설정을 따름).
 *
 * 첫 페인트 때의 `.dark` 는 `index.html` 의 인라인 스크립트가 이미 붙여 둔다 —
 * React 가 뜬 뒤에 붙이면 흰 화면이 한 번 번쩍이기 때문이다. 그래서 첫 적용에는 애니메이션 가드를 걸지 않는다.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readPreference()));
  const firstApply = useRef(true);

  useEffect(() => {
    const next = resolve(preference);
    setResolved(next);
    applyTheme(next, !firstApply.current);
    firstApply.current = false;
  }, [preference]);

  // system 일 때만 OS 설정이 바뀌는 걸 따라간다
  useEffect(() => {
    if (preference !== "system" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(DARK_QUERY);
    const handleChange = () => {
      const next: ResolvedTheme = media.matches ? "dark" : "light";
      setResolved(next);
      applyTheme(next, true);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 저장이 안 돼도 이번 세션 동안은 적용된다
    }
    setPreferenceState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
};
