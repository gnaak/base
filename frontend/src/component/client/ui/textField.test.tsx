import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TextField from "./textField";

describe("TextField (고객)", () => {
  it("라벨로 입력칸을 찾을 수 있고, 도움말이 aria-describedby 로 연결된다", () => {
    render(<TextField label="받는 분" hint="주문서에만 쓰여요" />);
    const input = screen.getByLabelText("받는 분");

    expect(input).not.toHaveAttribute("aria-invalid");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("주문서에만 쓰여요");
  });

  it("오류 문구가 있으면 aria-invalid 이고, describedby 가 도움말 대신 오류를 가리킨다", () => {
    render(<TextField label="휴대폰 번호" hint="배달 알림용" error="010-0000-0000 형식으로 입력해 주세요" />);
    const input = screen.getByLabelText("휴대폰 번호");

    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby")!;
    expect(describedBy.split(" ")).toHaveLength(1);
    expect(document.getElementById(describedBy)).toHaveTextContent("010-0000-0000 형식으로 입력해 주세요");
    expect(screen.queryByText("배달 알림용")).not.toBeInTheDocument();
  });

  it("error={true} 는 문구 없이 aria-invalid 만 — 도움말은 그대로 남는다", () => {
    render(<TextField label="쿠폰" hint="대소문자 구분" error />);
    const input = screen.getByLabelText("쿠폰");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent("대소문자 구분");
  });

  it("required 면 네이티브 required 가 붙는다", () => {
    render(<TextField label="이름" required />);
    expect(screen.getByLabelText(/이름/)).toBeRequired();
  });

  it("onChange 는 이벤트가 아니라 값을 넘긴다 (관리자 InputBox 와 같다)", () => {
    const handleChange = vi.fn();
    render(<TextField label="메모" onChange={handleChange} />);

    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "문 앞" } });
    expect(handleChange).toHaveBeenCalledWith("문 앞");
  });
});
