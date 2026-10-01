import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/context/ThemeProvider";
import { THEME_STORAGE_KEY } from "@/hooks/common/useTheme";
import ThemeToggle from "./themeToggle";

const mockSystemDark = (dark: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: dark, addEventListener: () => {}, removeEventListener: () => {} })),
  );

const renderToggle = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );

const lightBtn = () => screen.getByRole("button", { name: "라이트 모드" });
const darkBtn = () => screen.getByRole("button", { name: "다크 모드" });

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
  it("고른 적이 없으면 OS 설정 쪽이 눌려 있다", () => {
    mockSystemDark(true);
    renderToggle();

    expect(darkBtn()).toHaveAttribute("aria-pressed", "true");
    expect(lightBtn()).toHaveAttribute("aria-pressed", "false");
  });

  it("누르면 그 테마가 적용되고 저장된다", () => {
    mockSystemDark(false);
    renderToggle();

    fireEvent.click(darkBtn());
    expect(document.documentElement).toHaveClass("dark");
    expect(darkBtn()).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    fireEvent.click(lightBtn());
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("OS 가 다크여도 라이트를 고르면 라이트로 고정된다", () => {
    mockSystemDark(true);
    renderToggle();

    fireEvent.click(lightBtn());
    expect(document.documentElement).not.toHaveClass("dark");
    expect(lightBtn()).toHaveAttribute("aria-pressed", "true");
  });
});
