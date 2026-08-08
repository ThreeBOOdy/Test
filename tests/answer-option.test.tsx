import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnswerOption } from "@/components/training/answer-option";

describe("answer option semantics", () => {
  it("renders single choice as a radio control", () => {
    render(<AnswerOption index={0} option={{ id: "A", text: "选项 A" }} type="SINGLE_CHOICE" selected={false} disabled={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /选项 A/ })).toBeInTheDocument();
  });

  it("renders multiple choice as a checkbox control", () => {
    render(<AnswerOption index={0} option={{ id: "A", text: "选项 A" }} type="MULTIPLE_CHOICE" selected disabled={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /选项 A/ })).toBeChecked();
  });

  it("opens image zoom without toggling selection when clicking an image inside the option", async () => {
    const user = userEvent.setup();
    render(<AnswerOption index={0} option={{ id: "A", text: "请看图[图:qimg_1]" }} type="SINGLE_CHOICE" selected={false} disabled={false} onToggle={vi.fn()} />);
    await user.click(screen.getByRole("img", { name: "题目图片" }));
    expect(screen.getByRole("radio", { name: /请看图/ })).not.toBeChecked();
    expect(screen.getByRole("dialog", { name: "图片预览" })).toBeInTheDocument();
  });
});
