import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Select from "./select";

const OPTIONS = [
  { label: "택배", value: "parcel" },
  { label: "방문 수령", value: "pickup", disabled: true },
  { label: "퀵", value: 3 },
];

describe("Select — 직접 그린 둥근 목록", () => {
  it("누르면 목록이 열리고, 고르면 원래 타입 그대로 넘기고 닫힌다", () => {
    const onChange = vi.fn();
    render(<Select label="수령 방법" options={OPTIONS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox", { name: "수령 방법" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("option", { name: "퀵" }));
    expect(onChange).toHaveBeenCalledWith(3);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("키보드 — ↓ 로 열고 막힌 옵션은 건너뛰고 Enter 로 고른다", () => {
    const onChange = vi.fn();
    render(<Select label="수령 방법" options={OPTIONS} value="parcel" onChange={onChange} />);
    const trigger = screen.getByRole("combobox");

    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // 열기 — 지금 고른 '택배' 를 가리킨다
    expect(trigger.getAttribute("aria-activedescendant")).toMatch(/-0$/);
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // '방문 수령'(막힘) 을 건너뛴다
    expect(trigger.getAttribute("aria-activedescendant")).toMatch(/-2$/);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("Esc 는 목록만 닫는다 — 모달처럼 document 에서 듣는 쪽에는 가지 않는다", () => {
    const onDocumentKey = vi.fn();
    document.addEventListener("keydown", onDocumentKey);
    render(<Select options={OPTIONS} value={null} />);
    const trigger = screen.getByRole("combobox");

    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onDocumentKey).not.toHaveBeenCalled();
    document.removeEventListener("keydown", onDocumentKey);
  });
});
