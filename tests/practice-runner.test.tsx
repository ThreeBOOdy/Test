import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeRunner } from "@/components/practice-runner";
import { practiceSessionFixture } from "@/tests/fixtures/practice-session";

describe("PracticeRunner", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("opens the first unanswered question when resuming", () => {
    const session = practiceSessionFixture({ initialResults: { "question-1": { isCorrect: true, correctOptionIds: ["A"], selectedOptionIds: ["A"], answeredCount: 1, correctCount: 1 } } });
    render(<PracticeRunner session={session} />);
    expect(screen.getByText("下列哪些做法有助于减少业余电台干扰？")).toBeInTheDocument();
    expect(screen.getByText("第 2 / 2 题")).toBeInTheDocument();
  });

  it("selects with number keys and submits with Enter", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ isCorrect: true, correctOptionIds: ["A"], selectedOptionIds: ["A"], answeredCount: 1, correctCount: 1 }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<PracticeRunner session={practiceSessionFixture()} />);
    fireEvent.keyDown(window, { key: "1" });
    expect(screen.getByRole("button", { name: /每秒三十万千米/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it("keeps a draft while navigating", async () => {
    const user = userEvent.setup();
    render(<PracticeRunner session={practiceSessionFixture()} />);
    await user.click(screen.getByRole("button", { name: /每秒三十万千米/ }));
    await user.click(screen.getByRole("button", { name: "第 2 题，未答" }));
    await user.click(screen.getByRole("button", { name: "第 1 题，已选" }));
    expect(screen.getByRole("button", { name: /每秒三十万千米/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("alerts when a multiple answer is incomplete", async () => {
    const user = userEvent.setup();
    const question = practiceSessionFixture().questions[1];
    render(<PracticeRunner session={practiceSessionFixture({ questions: [question], total: 1 })} />);
    await user.click(screen.getByRole("button", { name: /使用合适的发射功率/ }));
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    expect(screen.getByRole("alert")).toHaveTextContent("本题要求选择 2 项");
  });
});
