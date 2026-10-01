/** 사용자가 고른 값. `system` 이면 OS 설정(prefers-color-scheme)을 따라간다. */
export type ThemePreference = "light" | "dark" | "system";

/** 지금 실제로 적용된 값 — `<html>` 에 `.dark` 가 붙어 있는지. */
export type ResolvedTheme = "light" | "dark";

export type ThemeContextType = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
};
