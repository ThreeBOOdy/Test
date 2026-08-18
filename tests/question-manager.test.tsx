import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeTreeNode } from "@/lib/domain/knowledge-tree";
import type { QuestionOption, QuestionStatus, QuestionType } from "@/lib/domain/types";

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/client/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { QuestionManager } from "@/components/question-manager";

const levels = [
  { id: "level-a", code: "A", name: "基础掌握", enabled: true },
  { id: "level-k", code: "K", name: "K 类综合", enabled: true },
  { id: "level-c", code: "C", name: "已停用类", enabled: false },
];

const types = [
  { id: "type-dg", code: "DG", name: "电工基础", enabled: true },
  { id: "type-tx", code: "TX", name: "通信原理", enabled: true },
];

const knowledgePointTrees: Record<string, KnowledgeTreeNode[]> = {
  "type-dg": [
    {
      id: "point-1",
      code: "4.1",
      name: "电路基础",
      parentId: null,
      path: "/4.1",
      depth: 0,
      sortOrder: 1,
      enabled: true,
      children: [
        {
          id: "point-2",
          code: "4.1.1",
          name: "导体和绝缘体",
          parentId: "point-1",
          path: "/4.1/4.1.1",
          depth: 1,
          sortOrder: 1,
          enabled: true,
          children: [],
        },
      ],
    },
  ],
  "type-tx": [
    {
      id: "point-3",
      code: "1.1",
      name: "信号基础",
      parentId: null,
      path: "/1.1",
      depth: 0,
      sortOrder: 1,
      enabled: true,
      children: [],
    },
  ],
};

function row(overrides: Partial<ReturnType<typeof baseRow>> = {}) {
  return { ...baseRow(), ...overrides };
}

function baseRow() {
  return {
    id: "question-1",
    levelIds: ["level-a", "level-k"],
    knowledgePointId: "point-2",
    knowledgePointTypeId: "type-dg",
    levelCode: "A级、K级",
    knowledgeCode: "4.1.1",
    knowledgeName: "导体和绝缘体",
    sourceBankCode: "BANK-1",
    externalQuestionCode: "Q-1",
    stem: "题干",
    type: "SINGLE_CHOICE" as QuestionType,
    selectionSpec: "2选1",
    preserveOptionOrder: false,
    options: [
      { id: "A", text: "正确" },
      { id: "B", text: "错误" },
    ] as QuestionOption[],
    correctOptionIds: ["A"],
    status: "ACTIVE" as QuestionStatus,
    version: 3,
  };
}

describe("QuestionManager (S8)", () => {
  beforeEach(() => {
    mocks.authenticatedFetch.mockReset();
    mocks.refresh.mockReset();
  });

  it("shows multiple letter classes on a question row", () => {
    render(<QuestionManager rows={[row()]} levels={levels} knowledgePointTypes={types} knowledgePointTrees={knowledgePointTrees} />);
    const questionRow = screen.getByText("导体和绝缘体").closest("tr")!;
    expect(within(questionRow).getByText("A级")).toBeInTheDocument();
    expect(within(questionRow).getByText("K级")).toBeInTheDocument();
  });

  it("opens edit with multi-select letter classes and tree-selected knowledge point", async () => {
    const user = userEvent.setup();
    render(<QuestionManager rows={[row()]} levels={levels} knowledgePointTypes={types} knowledgePointTrees={knowledgePointTrees} />);

    await user.click(screen.getByRole("button", { name: /编辑/ }));

    expect(screen.getByRole("checkbox", { name: "字母类 A" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "字母类 K" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "知识点类型" })).toHaveValue("type-dg");
    expect(screen.getByRole("radio", { name: /4\.1\.1 · 导体和绝缘体/ })).toBeChecked();
  });

  it("saves edit with levelIds array and selected knowledgePointId", async () => {
    const user = userEvent.setup();
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true, version: 4 }) });
    render(<QuestionManager rows={[row()]} levels={levels} knowledgePointTypes={types} knowledgePointTrees={knowledgePointTrees} />);

    await user.click(screen.getByRole("button", { name: /编辑/ }));
    await user.click(screen.getByRole("button", { name: "保存题目" }));

    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/questions/question-1", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({
        levelIds: ["level-a", "level-k"],
        knowledgePointId: "point-2",
        sourceBankCode: "BANK-1",
        externalQuestionCode: "Q-1",
        stem: "题干",
        preserveOptionOrder: false,
        options: [{ id: "A", text: "正确" }, { id: "B", text: "错误" }],
        correctOptionIds: ["A"],
        status: "ACTIVE",
        version: 3,
      }),
    }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("creates a question with multiple selected letter classes", async () => {
    const user = userEvent.setup();
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "question-2", version: 1 }) });
    render(<QuestionManager rows={[]} levels={levels} knowledgePointTypes={types} knowledgePointTrees={knowledgePointTrees} />);

    await user.click(screen.getByRole("button", { name: "新增题目" }));
    await user.type(screen.getByLabelText("题干"), "新题");
    await user.click(screen.getByRole("checkbox", { name: "字母类 A" }));
    await user.click(screen.getByRole("checkbox", { name: "字母类 K" }));
    await user.click(screen.getByRole("button", { name: "保存题目" }));

    const callBody = JSON.parse((mocks.authenticatedFetch.mock.calls[0][1] as { body: string }).body) as Record<string, unknown>;
    expect(callBody).toMatchObject({
      levelIds: ["level-a", "level-k"],
      knowledgePointId: "point-2",
      stem: "新题",
    });
    expect(callBody).not.toHaveProperty("knowledgePointTypeId");
    expect(callBody).not.toHaveProperty("id");
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/questions", expect.objectContaining({ method: "POST" }));
  });

  it("switches the knowledge point type tree and selects the first leaf of the new type", async () => {
    const user = userEvent.setup();
    render(<QuestionManager rows={[row()]} levels={levels} knowledgePointTypes={types} knowledgePointTrees={knowledgePointTrees} />);

    await user.click(screen.getByRole("button", { name: /编辑/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "知识点类型" }), { target: { value: "type-tx" } });

    expect(screen.getByRole("radio", { name: /1\.1 · 信号基础/ })).toBeChecked();
  });

  it("shows an API error without refreshing", async () => {
    const user = userEvent.setup();
    mocks.authenticatedFetch.mockResolvedValue({ ok: false, json: async () => ({ message: "字母类不存在或已停用" }) });
    render(<QuestionManager rows={[row()]} levels={levels} knowledgePointTypes={types} knowledgePointTrees={knowledgePointTrees} />);

    await user.click(screen.getByRole("button", { name: /编辑/ }));
    await user.click(screen.getByRole("button", { name: "保存题目" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("字母类不存在或已停用");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
