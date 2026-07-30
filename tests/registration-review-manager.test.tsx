import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationReviewManager } from "@/components/registration-review-manager";

const firstPage = { items: [{ id: "student-1", username: "radio-001", realName: "张三", school: "示例中学", grade: { name: "七年级" }, nationalIdMasked: "**************002X", phoneMasked: "***-***-8000", studentStatus: "PENDING" }], pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 } };
const secondPage = { items: [{ id: "student-21", username: "radio-021", realName: "李四", school: "示例中学", grade: { name: "八年级" }, nationalIdMasked: "**************003X", phoneMasked: "***-***-7000", studentStatus: "PENDING" }], pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 } };

describe("registration review manager", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads server-filtered pages and sends selected rows for bulk approval", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ approved: 1 }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<RegistrationReviewManager />);

    expect(await screen.findByText("张三")).toBeInTheDocument();
    await user.click(screen.getByLabelText("选择 张三"));
    await user.click(screen.getByRole("button", { name: "批量通过（1）" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/admin/registrations/bulk-approve", expect.objectContaining({ method: "POST" })));
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({ ids: ["student-1"] });
  });

  it("updates query state for search, filters, and pagination", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(secondPage), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<RegistrationReviewManager />);

    await screen.findByText("张三");
    await user.type(screen.getByLabelText("搜索申请"), "张三");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.selectOptions(screen.getByLabelText("审核状态"), "REJECTED");
    await user.click(screen.getByRole("button", { name: "下一页" }));

    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/v1/admin/registrations?page=2&pageSize=20&status=REJECTED&search=%E5%BC%A0%E4%B8%89"));
  });
});
