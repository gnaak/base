import type { CSSProperties } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfirmModal from "./confirmModal";
import Modal from "./modal";

describe("Modal (고객)", () => {
  it("document.body 로 portal 한다 — 렌더한 자리(sticky·transform 부모)에 갇히지 않게", () => {
    const { container } = render(
      <div style={{ transform: "translateZ(0)" }}>
        <Modal open onClose={() => {}} title="수령 방법" />
      </div>,
    );
    const dialog = screen.getByRole("dialog", { name: "수령 방법" });

    expect(container).not.toContainElement(dialog);
    expect(document.body).toContainElement(dialog);
  });

  it("ESC 로 닫힌다", () => {
    const handleClose = vi.fn();
    render(<Modal open onClose={handleClose} title="수령 방법" />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("열려 있는 동안 뒤 페이지 스크롤을 막고, 닫히면 되돌린다", () => {
    const { rerender } = render(<Modal open onClose={() => {}} title="수령 방법" />);
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<Modal open={false} onClose={() => {}} title="수령 방법" />);
    expect(document.body.style.overflow).toBe("");
  });

  it("겹쳐 열리면 ESC 는 맨 위 창만 닫는다", () => {
    const handleCloseModal = vi.fn();
    const handleCancelConfirm = vi.fn();
    render(
      <>
        <Modal open onClose={handleCloseModal} title="장바구니" />
        <ConfirmModal open title="비울까요?" onConfirm={() => {}} onCancel={handleCancelConfirm} />
      </>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleCancelConfirm).toHaveBeenCalledTimes(1);
    expect(handleCloseModal).not.toHaveBeenCalled();
  });

  it("portal 이 고객 화면 테마(data-theme · 인라인 변수)를 같이 들고 간다", () => {
    render(
      <div className="theme-client" data-theme="a" style={{ "--radius-card": "20px" } as CSSProperties}>
        <Modal open onClose={() => {}} title="테마 확인" />
      </div>,
    );
    const wrapper = screen.getByRole("dialog", { name: "테마 확인" }).closest(".theme-client") as HTMLElement;

    expect(wrapper.parentElement).toBe(document.body);
    expect(wrapper).toHaveAttribute("data-theme", "a");
    expect(wrapper.style.getPropertyValue("--radius-card")).toBe("20px");
  });
});
