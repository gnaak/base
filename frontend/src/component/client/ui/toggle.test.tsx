import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Toggle from "./toggle";

describe("Toggle (고객)", () => {
  it("role=switch 이고 누를 때마다 aria-checked 가 바뀐다 (비제어)", () => {
    const handleChange = vi.fn();
    render(<Toggle aria-label="푸시 알림" onChange={handleChange} />);
    const toggle = screen.getByRole("switch", { name: "푸시 알림" });

    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(handleChange).toHaveBeenLastCalledWith(true);
  });

  it("제어 모드에서는 부모 값이 바뀌기 전까지 그대로다", () => {
    const handleChange = vi.fn();
    render(<Toggle aria-label="마케팅 수신" checked={false} onChange={handleChange} />);
    const toggle = screen.getByRole("switch", { name: "마케팅 수신" });

    fireEvent.click(toggle);
    expect(handleChange).toHaveBeenCalledWith(true);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("disabled 면 바뀌지 않는다", () => {
    const handleChange = vi.fn();
    render(<Toggle aria-label="알림" disabled onChange={handleChange} />);

    fireEvent.click(screen.getByRole("switch", { name: "알림" }));
    expect(handleChange).not.toHaveBeenCalled();
  });
});
