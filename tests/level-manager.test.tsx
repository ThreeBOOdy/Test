import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/client/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { LevelManager } from "@/components/level-manager";

const levels = [
  { id: "level-a", code: "A", name: "基础掌握", sortOrder: 1, enabled: true, updatedAt: "2026-08-21T08:00:00.000Z", questionCount: 3 },
  { id: "level-k", code: "K", name: "K 类综合", sortOrder: 2, enabled: false, updatedAt: "2026-08-21T09:00:00.000Z", questionCount: 0 },
];

describe("LevelManager", () => {
  beforeEach(() => {
    mocks.authenticatedFetch.mockReset();
    mocks.refresh.mockReset();
  });

  it("shows level details, question counts and enabled state", () => {
    render(<LevelManager levels={levels} />);
    const levelA = screen.getByTestId("level-level-a");
    expect(within(levelA).getByText("基础掌握")).toBeInTheDocument();
    expect(within(levelA).getByText("A")).toBeInTheDocument();
    expect(within(levelA).getByText("3")).toBeInTheDocument();
    expect(within(levelA).getByText("启用")).toBeInTheDocument();
    expect(within(screen.getByTestId("level-level-k")).getByText("停用")).toBeInTheDocument();
    expect(within(screen.getByTestId("level-level-k")).getByText("K 类综合")).toBeInTheDocument();
  });

  it("creates a K level and refreshes the list", async () => {
    const user = userEvent.setup();
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "level-k" }) });
    render(<LevelManager levels={levels} />);
    await user.click(screen.getByRole("button", { name: "新增字母类" }));
    await user.type(screen.getByLabelText("字母类代码"), "K");
    await user.type(screen.getByLabelText("字母类名称"), "K 类综合");
    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "2" } });
    await user.click(screen.getByRole("button", { name: "保存字母类" }));
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/levels", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ code: "K", name: "K 类综合", sortOrder: 2, enabled: true }),
    }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("edits a level name, order and enabled state using the row updatedAt", async () => {
    const user = userEvent.setup();
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
    render(<LevelManager levels={levels} />);
    await user.click(within(screen.getByTestId("level-level-a")).getByRole("button", { name: "编辑" }));
    await user.clear(screen.getByLabelText("字母类名称"));
    await user.type(screen.getByLabelText("字母类名称"), "基础掌握（新版）");
    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "10" } });
    await user.click(screen.getByLabelText("启用"));
    await user.click(screen.getByRole("button", { name: "保存字母类" }));
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/levels/level-a", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ name: "基础掌握（新版）", sortOrder: 10, enabled: false, updatedAt: levels[0].updatedAt }),
    }));
  });

  it("disables a level through the dedicated endpoint", async () => {
    const user = userEvent.setup();
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
    render(<LevelManager levels={levels} />);
    await user.click(within(screen.getByTestId("level-level-a")).getByRole("button", { name: "停用" }));
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/levels/level-a/disable", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("shows API conflicts without refreshing", async () => {
    const user = userEvent.setup();
    mocks.authenticatedFetch.mockResolvedValue({ ok: false, json: async () => ({ message: "字母类已被其他教师修改，请刷新后重试" }) });
    render(<LevelManager levels={levels} />);
    await user.click(within(screen.getByTestId("level-level-a")).getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "保存字母类" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("字母类已被其他教师修改，请刷新后重试");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
