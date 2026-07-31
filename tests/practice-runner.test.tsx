import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeRunner } from "@/components/practice-runner";
import { practiceSessionFixture } from "@/tests/fixtures/practice-session";

describe("PracticeRunner", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("hides question type, level and knowledge metadata from students", () => {
    render(<PracticeRunner session={practiceSessionFixture()} />);
    expect(screen.queryByText("单选题", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("A级", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText(/A级综合练习/)).not.toBeInTheDocument();
    expect(screen.queryByText("1.1.1", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("电波基础", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText(/一个或多个|最符合题意/)).not.toBeInTheDocument();
    expect(screen.getByText("请选择你认为正确的答案。")).toBeInTheDocument();
  });

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
    expect(screen.getByRole("radio", { name: /每秒三十万千米/ })).toBeChecked();
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({ questionId: "question-1", selectedOptionIds: ["A"], idempotencyKey: expect.any(String) });
  });

  it("keeps a draft while navigating", async () => {
    const user = userEvent.setup();
    render(<PracticeRunner session={practiceSessionFixture()} />);
    await user.click(screen.getByRole("radio", { name: /每秒三十万千米/ }));
    await user.click(screen.getByRole("button", { name: "第 2 题，未答" }));
    await user.click(screen.getByRole("button", { name: "第 1 题，已选" }));
    expect(screen.getByRole("radio", { name: /每秒三十万千米/ })).toBeChecked();
  });

  it("allows submitting any non-empty multiple-choice selection", async () => {
    const user = userEvent.setup();
    const question = practiceSessionFixture().questions[1];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ isCorrect: false, correctOptionIds: ["A", "B"], selectedOptionIds: ["A"], answeredCount: 1, correctCount: 0 }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<PracticeRunner session={practiceSessionFixture({ questions: [question], total: 1 })} />);
    await user.click(screen.getByRole("checkbox", { name: /使用合适的发射功率/ }));
    await user.click(screen.getAllByRole("button", { name: "提交答案" })[0]);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it("shows the final answer feedback before opening the summary", async () => {
    const user = userEvent.setup();
    const question = practiceSessionFixture().questions[0];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      isCorrect: true,
      correctOptionIds: ["A"],
      selectedOptionIds: ["A"],
      answeredCount: 1,
      correctCount: 1,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<PracticeRunner session={practiceSessionFixture({ questions: [question], total: 1 })} />);
    await user.click(screen.getByRole("radio", { name: /每秒三十万千米/ }));
    await user.click(screen.getAllByRole("button", { name: "提交答案" })[0]);

    expect(await screen.findByText("回答正确", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(/解析功能将在教师审核后开放/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "查看结果" })[0]).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "训练完成" })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "查看结果" })[0]);
    expect(screen.getByRole("heading", { name: "训练完成" })).toBeInTheDocument();
  });

  it("submits mock exam answers together and shows the pass result", async () => {
    const user = userEvent.setup();
    const question = practiceSessionFixture().questions[0];
    vi.mocked(fetch).mockImplementation(async (input) => new Response(JSON.stringify(input.toString().endsWith("/submit") ? { results: { [question.id]: { isCorrect: true, correctOptionIds: ["A"], selectedOptionIds: ["A"], answeredCount: 1, correctCount: 1 } }, correctCount: 1, total: 1, passingCount: 1, passed: true } : { version: 1, answers: { [question.id]: ["A"] }, currentIndex: 0, updatedAt: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<PracticeRunner session={practiceSessionFixture({ mode: "MOCK_EXAM", title: "A级 · 模拟考试", questions: [question], total: 1, exam: { durationMinutes: 40, passingCount: 1, expiresAt: new Date(Date.now() + 40 * 60_000).toISOString() } })} />);

    await user.click(screen.getByRole("radio", { name: /每秒三十万千米/ }));
    await user.click(screen.getAllByRole("button", { name: "提交试卷" })[0]);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/practice-sessions/session-1/submit", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByRole("heading", { name: "模拟考试完成" })).toBeInTheDocument();
    expect(screen.getByText("考试合格")).toBeInTheDocument();
  });

  it("restores the latest exam draft and position", () => {
    const question = practiceSessionFixture().questions[0];
    render(<PracticeRunner session={practiceSessionFixture({ mode: "MOCK_EXAM", questions: [question], total: 1, draft: { answers: { [question.id]: ["A"] }, currentIndex: 0, version: 3, updatedAt: new Date().toISOString() }, exam: { durationMinutes: 40, passingCount: 1, expiresAt: new Date(Date.now() + 40 * 60_000).toISOString() } })} />);
    expect(screen.getByRole("radio", { name: /每秒三十万千米/ })).toBeChecked();
    expect(screen.getByText("第 1 / 1 题")).toBeInTheDocument();
    expect(screen.queryByText("标准答案：A")).not.toBeInTheDocument();
  });
});
