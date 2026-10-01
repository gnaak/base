import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import { THEME_STORAGE_KEY, useTheme } from "@/hooks/common/useTheme";

// OS 다크모드 설정을 흉내 낸다. change 이벤트를 쏠 수 있게 리스너를 붙잡아 둔다.
const mockSystemTheme = (dark: boolean) => {
  const listeners = new Set<() => void>();
  const media = {
    matches: dark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  return {
    change: (nextDark: boolean) => {
      media.matches = nextDark;
      listeners.forEach((fn) => fn());
    },
  };
};

const Probe = () => {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setPreference("light")}>light</button>
      <button onClick={() => setPreference("dark")}>dark</button>
      <button onClick={() => setPreference("system")}>system</button>
    </div>
  );
};

const html = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  html().classList.remove("dark", "theme-switching");
});

afterEach(() => {
  localStorage.clear();
  html().classList.remove("dark", "theme-switching");
});

describe("ThemeProvider", () => {
  it("저장된 값이 없으면 OS 설정을 따른다 — 다크", () => {
    mockSystemTheme(true);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
    expect(html()).toHaveClass("dark");
  });

  it("저장된 값이 없으면 OS 설정을 따른다 — 라이트", () => {
    mockSystemTheme(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(html()).not.toHaveClass("dark");
  });

  it("저장된 light 는 OS 가 다크여도 이긴다", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    mockSystemTheme(true);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(html()).not.toHaveClass("dark");
  });

  it("다크를 고르면 .dark 가 붙고 저장된다", () => {
    mockSystemTheme(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => screen.getByRole("button", { name: "dark" }).click());
    expect(html()).toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("system 으로 돌아가면 저장값을 지우고 다시 OS 를 따른다", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    mockSystemTheme(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(html()).toHaveClass("dark");
    act(() => screen.getByRole("button", { name: "system" }).click());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(html()).not.toHaveClass("dark");
  });

  it("system 일 때 OS 설정이 바뀌면 따라간다", () => {
    const system = mockSystemTheme(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => system.change(true));
    expect(html()).toHaveClass("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("직접 고른 뒤에는 OS 설정이 바뀌어도 따라가지 않는다", () => {
    const system = mockSystemTheme(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => screen.getByRole("button", { name: "light" }).click());
    act(() => system.change(true));
    expect(html()).not.toHaveClass("dark");
  });

  it("matchMedia 가 없는 환경에서도 깨지지 않는다 (라이트로)", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });
});
