import { render, screen } from "@testing-library/react";
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
});
