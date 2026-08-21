import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/client/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { ExamBlueprintManager, type BlueprintManagerRow } from "@/components/exam-blueprint-manager";
import type { KnowledgePoint, Level, Question } from "@/lib/domain/types";

const levels: Level[] = [
  { id: "level-a", code: "A", name: "基础掌握", sortOrder: 1, enabled: true },
];

const points: KnowledgePoint[] = [
  { id: "kp-root", code: "1", name: "无线电基础", parentId: null, path: "/1", depth: 0, sortOrder: 0, enabled: true },
  { id: "kp-child", code: "1.1", name: "电波基础", parentId: "kp-root", path: "/1/1.1", depth: 1, sortOrder: 0, enabled: true },
  { id: "kp-sibling", code: "2", name: "通信原理", parentId: null, path: "/2", depth: 0, sortOrder: 1, enabled: true },
];

const questions: Question[] = [
  {
    id: "q1",
    levelIds: ["level-a"],
    knowledgePointId: "kp-child",
    stem: "单选一",
    type: "SINGLE_CHOICE",
    optionCount: 2,
    correctOptionCount: 1,
    selectionSpec: "2选1",
    options: [{ id: "A", text: "A" }, { id: "B", text: "B" }],
    correctOptionIds: ["A"],
    status: "ACTIVE",
  },
  {
    id: "q2",
    levelIds: ["level-a"],
    knowledgePointId: "kp-child",
    stem: "多选一",
    type: "MULTIPLE_CHOICE",
    optionCount: 3,
    correctOptionCount: 2,
    selectionSpec: "3选2",
    options: [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }],
    correctOptionIds: ["A", "C"],
    status: "ACTIVE",
  },
];

const blueprint: BlueprintManagerRow = {
  id: "bp-1",
  levelId: "level-a",
  name: "期中模拟",
  durationMinutes: 40,
  passingCount: 20,
  enabled: true,
  isDefault: true,
  totalCount: 2,
  items: [
    {
      id: "item-1",
      knowledgePointId: "kp-child",
      knowledgePoint: { id: "kp-child", code: "1.1", name: "电波基础", path: "/1/1.1" },
      singleCount: 1,
      multipleCount: 1,
    },
  ],
};

describe("ExamBlueprintManager", () => {
  beforeEach(() => {
    mocks.authenticatedFetch.mockReset();
    mocks.refresh.mockReset();
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "bp-new" }) });
  });

  it("renders blueprint list with names, default badge, total and actions", () => {
    render(<ExamBlueprintManager levels={levels} points={points} questions={questions} blueprints={[blueprint]} />);

    const row = screen.getByTestId("blueprint-bp-1");
    expect(within(row).getByText("期中模拟")).toBeInTheDocument();
    expect(within(row).getByText("默认")).toBeInTheDocument();
    expect(within(row).getByText(/1 个条目 · 共 2 题 · 40 分钟 · 合格 20 题/)).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "编辑" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "复制" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "删除" })).toBeInTheDocument();
  });

  it("copies a blueprint through the copy endpoint and refreshes", async () => {
    const user = userEvent.setup();
    render(<ExamBlueprintManager levels={levels} points={points} questions={questions} blueprints={[blueprint]} />);

    await user.click(screen.getByRole("button", { name: "复制" }));

    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/exam-blueprints/bp-1/copy", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({}),
    }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("deletes a blueprint after confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ExamBlueprintManager levels={levels} points={points} questions={questions} blueprints={[blueprint]} />);

    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(confirm).toHaveBeenCalledWith("确定删除蓝图“期中模拟”？删除后不可恢复。");
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/exam-blueprints/bp-1", expect.objectContaining({ method: "DELETE" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("creates a blueprint by selecting a knowledge point from the tree", async () => {
    const user = userEvent.setup();
    render(<ExamBlueprintManager levels={levels} points={points} questions={questions} blueprints={[]} />);

    await user.click(screen.getByRole("button", { name: "新增蓝图" }));
    await user.type(screen.getByLabelText("蓝图名称"), "期末冲刺");
    await user.clear(screen.getByLabelText("合格题数"));
    await user.type(screen.getByLabelText("合格题数"), "1");

    await user.click(screen.getByRole("button", { name: "添加知识点条目" }));
    const dialog = screen.getByRole("dialog", { name: "选择知识点" });
    await user.click(within(dialog).getByRole("button", { name: /选择知识点 1\.1 电波基础/ }));

    expect(screen.getByLabelText("1.1 单选数量")).toHaveValue(1);

    await user.click(screen.getByRole("button", { name: "保存蓝图" }));

    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/exam-blueprints", expect.objectContaining({ method: "POST" }));
    const [url, init] = mocks.authenticatedFetch.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("/api/v1/teacher/exam-blueprints");
    expect(JSON.parse(init.body)).toEqual({
      levelId: "level-a",
      name: "期末冲刺",
      durationMinutes: null,
      passingCount: 1,
      enabled: true,
      isDefault: false,
      items: [{ knowledgePointId: "kp-child", singleCount: 1, multipleCount: 0 }],
    });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("disables ancestor and descendant nodes that overlap existing selections", async () => {
    const user = userEvent.setup();
    render(<ExamBlueprintManager levels={levels} points={points} questions={questions} blueprints={[blueprint]} />);

    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "添加知识点条目" }));

    const dialog = screen.getByRole("dialog", { name: "选择知识点" });
    expect(within(dialog).getByRole("button", { name: /选择知识点 1 无线电基础/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /选择知识点 1\.1 电波基础/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /选择知识点 2 通信原理/ })).toBeEnabled();
  });

  it("shows real-time inventory shortage while editing counts", async () => {
    const user = userEvent.setup();
    render(<ExamBlueprintManager levels={levels} points={points} questions={questions} blueprints={[blueprint]} />);

    await user.click(screen.getByRole("button", { name: "编辑" }));
    const singleInput = screen.getByLabelText("1.1 单选数量");
    await user.clear(singleInput);
    await user.type(singleInput, "2");

    expect(screen.getByRole("status")).toHaveTextContent("库存不足");
    expect(screen.getByRole("status")).toHaveTextContent("单选缺 1 题");
    expect(screen.getByText("缺 1 题单选")).toBeInTheDocument();
  });
});
