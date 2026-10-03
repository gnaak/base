import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home, Receipt, User } from "lucide-react";
import { describe, expect, it } from "vitest";
import BottomTab, { type BottomTabItem } from "./bottomTab";

const ITEMS: BottomTabItem[] = [
  { label: "홈", to: "/", icon: Home },
  { label: "주문", to: "/orders", icon: Receipt },
  { label: "내 정보", to: "/me", icon: User },
];

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTab items={ITEMS} />
    </MemoryRouter>,
  );

describe("BottomTab", () => {
  it("지금 경로의 탭만 aria-current=page 다", () => {
    renderAt("/orders");

    expect(screen.getByRole("link", { name: "주문" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "내 정보" })).not.toHaveAttribute("aria-current");
  });

  it("하위 경로에서도 그 탭이 켜지고, '/' 탭은 end 없이도 모든 경로에서 켜지지 않는다", () => {
    renderAt("/orders/123");

    expect(screen.getByRole("link", { name: "주문" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
  });

  it("nav 에 이름이 있다 — 화면 읽기 프로그램용", () => {
    renderAt("/");
    expect(screen.getByRole("navigation", { name: "주요 메뉴" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute("aria-current", "page");
  });
});
