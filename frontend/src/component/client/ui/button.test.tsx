import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Button from "./button";

describe("Button (고객)", () => {
  it("기본 type 은 button 이다 — 폼 안에서 의도치 않게 submit 되지 않게", () => {
    render(<Button>담기</Button>);
    expect(screen.getByRole("button", { name: "담기" })).toHaveAttribute("type", "button");
  });

  it("loading 이면 눌리지 않고 aria-busy 가 붙는다 — 글자는 그대로라 이름으로 찾을 수 있다", () => {
    const handleClick = vi.fn();
    render(
      <Button loading onClick={handleClick}>
        저장
      </Button>,
    );
    const button = screen.getByRole("button", { name: "저장" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("loading 이 아니면 aria-busy 가 없다", () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole("button", { name: "저장" })).not.toHaveAttribute("aria-busy");
  });

  it("disabled 면 onClick 이 불리지 않는다", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        주문하기
      </Button>,
    );
    const button = screen.getByRole("button", { name: "주문하기" });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
