import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/client/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { KnowledgeManager } from "@/components/knowledge-manager";

const points = [
  { id: "root-1", parentId: null, code: "1", name: "大类一", depth: 0, sortOrder: 0, enabled: true, version: 1, childCount: 1, questionCount: 0 },
  { id: "child-1", parentId: "root-1", code: "1.1", name: "小类一", depth: 1, sortOrder: 0, enabled: true, version: 1, childCount: 0, questionCount: 3 },
  { id: "root-2", parentId: null, code: "2", name: "大类二", depth: 0, sortOrder: 1, enabled: true, version: 1, childCount: 0, questionCount: 5 },
];

describe("KnowledgeManager", () => {
  beforeEach(() => {
    mocks.authenticatedFetch.mockReset();
    mocks.refresh.mockReset();
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
  });

  it("shows only top-level categories by default and expands children on click", () => {
    render(<KnowledgeManager points={points} />);

    expect(screen.getByText("大类一")).toBeInTheDocument();
    expect(screen.getByText("大类二")).toBeInTheDocument();
    expect(screen.queryByText("小类一")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开" }));
    expect(screen.getByText("小类一")).toBeInTheDocument();
  });

  it("search reveals matching child nodes together with their ancestors", async () => {
    const user = userEvent.setup();
    render(<KnowledgeManager points={points} />);

    await user.type(screen.getByPlaceholderText("搜索分类号或知识点名称"), "小类一");

    expect(screen.getByText("大类一")).toBeInTheDocument();
    expect(screen.getByText("小类一")).toBeInTheDocument();
    expect(screen.queryByText("大类二")).not.toBeInTheDocument();
  });

  it("supports expanding and collapsing all categories", () => {
    render(<KnowledgeManager points={points} />);

    fireEvent.click(screen.getByRole("button", { name: "全部展开" }));
    expect(screen.getByText("小类一")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "全部收起" }));
    expect(screen.queryByText("小类一")).not.toBeInTheDocument();
  });

  it("sorts categories by their code sequence instead of the sortOrder field", () => {
    const unsortedPoints = [
      { id: "p1", parentId: null, code: "1", name: "大类一", depth: 0, sortOrder: 0, enabled: true, version: 1, childCount: 0, questionCount: 0 },
      { id: "p2", parentId: null, code: "2", name: "大类二", depth: 0, sortOrder: 0, enabled: true, version: 1, childCount: 0, questionCount: 0 },
      { id: "p3", parentId: null, code: "3", name: "大类三", depth: 0, sortOrder: 0, enabled: true, version: 1, childCount: 0, questionCount: 0 },
      { id: "p5", parentId: null, code: "5", name: "大类五", depth: 0, sortOrder: 0, enabled: true, version: 1, childCount: 0, questionCount: 0 },
      { id: "p4", parentId: null, code: "4", name: "大类四", depth: 0, sortOrder: 1, enabled: true, version: 1, childCount: 0, questionCount: 0 },
    ];

    render(<KnowledgeManager points={unsortedPoints} />);

    expect(screen.getAllByText(/^大类/).map((element) => element.textContent)).toEqual([
      "大类一",
      "大类二",
      "大类三",
      "大类四",
      "大类五",
    ]);
  });
});
