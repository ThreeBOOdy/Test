import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/client/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { KnowledgePointTypeManager } from "@/components/knowledge-point-type-manager";

const types = [
  { id: "type-dg", code: "DG", name: "电工基础", sortOrder: 1, enabled: true, updatedAt: "2026-08-21T08:00:00.000Z", pointCount: 2 },
  { id: "type-tx", code: "TX", name: "通信原理", sortOrder: 2, enabled: false, updatedAt: "2026-08-21T09:00:00.000Z", pointCount: 0 },
];

const points = [
  { id: "point-1", parentId: null, code: "4.1", name: "电路基础", depth: 0, sortOrder: 1, enabled: true, version: 1, childCount: 1, questionCount: 0 },
  { id: "point-2", parentId: "point-1", code: "4.1.1", name: "导体和绝缘体", depth: 1, sortOrder: 1, enabled: true, version: 2, childCount: 0, questionCount: 3 },
];

describe("KnowledgePointTypeManager", () => {
  beforeEach(() => {
    mocks.authenticatedFetch.mockReset();
    mocks.refresh.mockReset();
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
  });

  it("shows types, active type tree and disabled state", () => {
    render(<KnowledgePointTypeManager types={types} points={points} selectedTypeId="type-dg" />);
    const typeDg = screen.getByTestId("knowledge-point-type-type-dg");
    expect(within(typeDg).getByText("电工基础")).toBeInTheDocument();
    expect(within(typeDg).getByText(/DG/)).toBeInTheDocument();
    expect(within(typeDg).getByText("2")).toBeInTheDocument();
    expect(within(typeDg).getByText("启用")).toBeInTheDocument();
    expect(within(screen.getByTestId("knowledge-point-type-type-tx")).getByText("停用")).toBeInTheDocument();
    expect(screen.getByText("知识点树：电工基础")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开" }));
    expect(screen.getByText("导体和绝缘体")).toBeInTheDocument();
  });

  it("creates a knowledge point type", async () => {
    const user = userEvent.setup();
    render(<KnowledgePointTypeManager types={types} points={points} selectedTypeId="type-dg" />);
    await user.click(screen.getByRole("button", { name: "新增类型" }));
    await user.type(screen.getByLabelText("类型代码"), "jy");
    await user.type(screen.getByLabelText("类型名称"), "军用通信");
    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "3" } });
    await user.click(screen.getByRole("button", { name: "保存类型" }));
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/knowledge-point-types", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ code: "JY", name: "军用通信", sortOrder: 3, enabled: true }),
    }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("edits a knowledge point type using the row updatedAt", async () => {
    const user = userEvent.setup();
    render(<KnowledgePointTypeManager types={types} points={points} selectedTypeId="type-dg" />);
    await user.click(within(screen.getByTestId("knowledge-point-type-type-dg")).getByRole("button", { name: "编辑" }));
    await user.clear(screen.getByLabelText("类型名称"));
    await user.type(screen.getByLabelText("类型名称"), "电工基础（新版）");
    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "10" } });
    await user.click(screen.getByRole("button", { name: "保存类型" }));
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/knowledge-point-types/type-dg", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ name: "电工基础（新版）", sortOrder: 10, enabled: true, updatedAt: types[0].updatedAt }),
    }));
  });

  it("disables a knowledge point type", async () => {
    const user = userEvent.setup();
    render(<KnowledgePointTypeManager types={types} points={points} selectedTypeId="type-dg" />);
    await user.click(within(screen.getByTestId("knowledge-point-type-type-dg")).getByRole("button", { name: "停用" }));
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/knowledge-point-types/type-dg/disable", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("creates a knowledge point under the active type", async () => {
    const user = userEvent.setup();
    render(<KnowledgePointTypeManager types={types} points={points} selectedTypeId="type-dg" />);
    await user.click(screen.getByRole("button", { name: "新增知识点" }));
    await user.type(screen.getByLabelText("分类号"), "4.1.2");
    await user.type(screen.getByLabelText("知识点名称"), "并联电路");
    await user.click(screen.getByRole("button", { name: "保存知识点" }));
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith("/api/v1/teacher/knowledge-points", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ typeId: "type-dg", code: "4.1.2", name: "并联电路", sortOrder: 0, enabled: true }),
    }));
  });
});
