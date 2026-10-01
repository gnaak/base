import { ThemeContextType } from "@/types/theme";
import { createContext, useContext } from "react";

/**
 * localStorage 키. `index.html` 의 첫 페인트 스크립트도 같은 키·같은 규칙으로 `.dark` 를 붙인다 —
 * 둘이 어긋나면 새로고침할 때 테마가 한 번 뒤집혔다가 돌아온다.
 */
export const THEME_STORAGE_KEY = "theme";

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
