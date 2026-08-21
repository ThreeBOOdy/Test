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

  it("auto-expands approved explanation after a wrong answer", async () => {
    const user = userEvent.setup();
    const question = practiceSessionFixture().questions[0];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ isCorrect: false, correctOptionIds: ["A"], selectedOptionIds: ["B"], answeredCount: 1, correctCount: 0, explanation: { summary: "因为中继台需避开航空业务", knowledge: "题干考察中继台频率规划", memory: "航空业务优先" } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<PracticeRunner session={practiceSessionFixture({ questions: [question], total: 1 })} />);

    await user.click(screen.getByRole("radio", { name: /每秒三十万千米/ }));
    await user.click(screen.getAllByRole("button", { name: "提交答案" })[0]);

    expect(await screen.findByText("一句话解析")).toBeInTheDocument();
    expect(screen.getByText("知识点讲解")).toBeInTheDocument();
    expect(screen.getByText("记忆点")).toBeInTheDocument();
    expect(screen.queryByText("老师正在补充解析，请稍后再来看看。")).not.toBeInTheDocument();
  });

  it("keeps approved explanation collapsed after a correct answer and opens on demand", async () => {
    const user = userEvent.setup();
    const question = practiceSessionFixture().questions[0];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ isCorrect: true, correctOptionIds: ["A"], selectedOptionIds: ["A"], answeredCount: 1, correctCount: 1, explanation: { summary: "因为中继台需避开航空业务", knowledge: "题干考察中继台频率规划", memory: "航空业务优先" } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<PracticeRunner session={practiceSessionFixture({ questions: [question], total: 1 })} />);

    await user.click(screen.getByRole("radio", { name: /每秒三十万千米/ }));
    await user.click(screen.getAllByRole("button", { name: "提交答案" })[0]);

    const toggle = await screen.findByRole("button", { name: "查看解析" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("一句话解析")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText("一句话解析")).toBeInTheDocument();
    expect(screen.getByText("知识点讲解")).toBeInTheDocument();
    expect(screen.getByText("记忆点")).toBeInTheDocument();
  });

  it("shows the friendly placeholder when no approved explanation is available", async () => {
    const user = userEvent.setup();
    const question = practiceSessionFixture().questions[0];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ isCorrect: false, correctOptionIds: ["A"], selectedOptionIds: ["B"], answeredCount: 1, correctCount: 0, explanation: null }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<PracticeRunner session={practiceSessionFixture({ questions: [question], total: 1 })} />);

    await user.click(screen.getByRole("radio", { name: /每秒三十万千米/ }));
    await user.click(screen.getAllByRole("button", { name: "提交答案" })[0]);

    expect(await screen.findByText("老师正在补充解析，请稍后再来看看。")).toBeInTheDocument();
  });

  it("submits mock exam answers together and shows the pass result", async () => {
    const user = userEvent.setup();
    const question = practiceSessionFixture().questions[0];
    vi.mocked(fetch).mockImplementation(async (input) => new Response(JSON.stringify(input.toString().endsWith("/submit") ? { results: { [question.id]: { isCorrect: true, correctOptionIds: ["A"], selectedOptionIds: ["A"], answeredCount: 1, correctCount: 1 } }, correctCount: 1, total: 1, passingCount: 1, passed: true, settlementSource: "STUDENT_SUBMISSION", completedAt: new Date().toISOString() } : { version: 1, answers: { [question.id]: ["A"] }, currentIndex: 0, updatedAt: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json" } }));
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

  it("shows sequential round count and resume position for order sessions", () => {
    render(<PracticeRunner session={practiceSessionFixture({ mode: "QUESTION_ORDER", title: "A级 · 顺序练习", sequentialProgress: { lastIndex: 1, roundCount: 2 } })} />);

    expect(screen.getByText("完成 2 轮")).toBeInTheDocument();
    expect(screen.getByText("上次做到第 2 / 2 题")).toBeInTheDocument();
  });

  it("shows the sequential mode switch and defaults to practice mode", () => {
    render(<PracticeRunner session={practiceSessionFixture({ mode: "QUESTION_ORDER", title: "A级 · 顺序练习", sequentialProgress: { lastIndex: 0, roundCount: 0 } })} />);

    const practiceButton = screen.getByRole("button", { name: "练习模式" });
    const learningButton = screen.getByRole("button", { name: "学习模式" });
    expect(practiceButton).toHaveAttribute("aria-pressed", "true");
    expect(learningButton).toHaveAttribute("aria-pressed", "false");
  });

  it("switches sequential mode without resetting current round progress", async () => {
    const session = practiceSessionFixture({
      mode: "QUESTION_ORDER",
      title: "A级 · 顺序练习",
      sequentialProgress: { lastIndex: 1, roundCount: 0 },
      initialResults: { "question-1": { isCorrect: true, correctOptionIds: ["A"], selectedOptionIds: ["A"], answeredCount: 1, correctCount: 1 } },
    });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ learningMode: true }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<PracticeRunner session={session} />);
    expect(screen.getByText("第 2 / 2 题")).toBeInTheDocument();
    expect(screen.getByText("下列哪些做法有助于减少业余电台干扰？")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "学习模式" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/practice-sessions/session-1/mode", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ learningMode: true }) })));
    expect(screen.getByRole("button", { name: "学习模式" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("第 2 / 2 题")).toBeInTheDocument();
    expect(screen.getByText("下列哪些做法有助于减少业余电台干扰？")).toBeInTheDocument();
  });

  it.each(["QUESTION_ORDER", "RANDOM_ALL", "WRONG_QUESTION", "FAVORITE"] as const)("shows favorite and ignore buttons for %s", (mode) => {
    render(<PracticeRunner session={practiceSessionFixture({ mode, title: "练习" })} />);

    expect(screen.getByRole("button", { name: "收藏" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "忽略" })).toBeInTheDocument();
  });

  it("does not show favorite and ignore buttons in mock exams", () => {
    const question = practiceSessionFixture().questions[0];
    render(<PracticeRunner session={practiceSessionFixture({
      mode: "MOCK_EXAM",
      title: "A级 · 模拟考试",
      questions: [question],
      total: 1,
      exam: { durationMinutes: 40, passingCount: 1, expiresAt: new Date(Date.now() + 40 * 60_000).toISOString() },
    })} />);

    expect(screen.queryByRole("button", { name: "收藏" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "忽略" })).not.toBeInTheDocument();
  });

  it("does not show favorite and ignore buttons in level comprehensive practice", () => {
    render(<PracticeRunner session={practiceSessionFixture()} />);

    expect(screen.queryByRole("button", { name: "收藏" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "忽略" })).not.toBeInTheDocument();
  });

  it("reflects existing favorite/ignored marks from the session", () => {
    const question = { ...practiceSessionFixture().questions[0], favorite: true, ignored: true };
    render(<PracticeRunner session={practiceSessionFixture({ mode: "QUESTION_ORDER", questions: [question], total: 1 })} />);

    expect(screen.getByRole("button", { name: "收藏" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "忽略" })).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles favorite through the question state API and updates immediately", async () => {
    const user = userEvent.setup();
    const question = practiceSessionFixture().questions[0];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ questionId: question.id, levelId: "level-a", levelCode: "A", favorite: true, ignored: false }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<PracticeRunner session={practiceSessionFixture({ mode: "QUESTION_ORDER", questions: [question], total: 1 })} />);
    const favoriteButton = screen.getByRole("button", { name: "收藏" });
    expect(favoriteButton).toHaveAttribute("aria-pressed", "false");

    await user.click(favoriteButton);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/v1/student/question-states/${question.id}`, expect.objectContaining({ method: "PATCH", body: JSON.stringify({ favorite: true }) })));
    expect(screen.getByRole("button", { name: "收藏" })).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles ignore through the question state API and updates immediately", async () => {
    const user = userEvent.setup();
    const question = practiceSessionFixture().questions[0];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ questionId: question.id, levelId: "level-a", levelCode: "A", favorite: false, ignored: true }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<PracticeRunner session={practiceSessionFixture({ mode: "RANDOM_ALL", questions: [question], total: 1 })} />);
    const ignoreButton = screen.getByRole("button", { name: "忽略" });
    expect(ignoreButton).toHaveAttribute("aria-pressed", "false");

    await user.click(ignoreButton);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/v1/student/question-states/${question.id}`, expect.objectContaining({ method: "PATCH", body: JSON.stringify({ ignored: true }) })));
    expect(screen.getByRole("button", { name: "忽略" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the stage-complete encouragement for random sessions that reached long-term review", () => {
    render(<PracticeRunner session={practiceSessionFixture({ mode: "RANDOM_ALL", title: "A级 · 智能随机练习", stageCompleted: true })} />);

    expect(screen.getByText("阶段性完成")).toBeInTheDocument();
    expect(screen.getByText(/所有题目已进入长期复习/)).toBeInTheDocument();
  });

  it("does not show the stage-complete banner unless the random stage flag is true", () => {
    render(<PracticeRunner session={practiceSessionFixture({ mode: "RANDOM_ALL", title: "A级 · 智能随机练习", stageCompleted: false })} />);

    expect(screen.queryByText("阶段性完成")).not.toBeInTheDocument();  });
});
