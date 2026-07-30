import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationStatus, type RegistrationStatusData } from "@/components/registration-status";

const pending: RegistrationStatusData = {
  username: "student-7",
  realName: "周同学",
  displayName: "周同学",
  nationalIdMasked: "110***********1234",
  gender: "MALE",
  school: "第一中学",
  grade: { id: "grade-7", name: "七年级" },
  phoneMasked: "138****5678",
  studentStatus: "PENDING",
  submittedAt: "2026-07-26T08:00:00.000Z",
  rejectionReason: null,
  reviewedAt: null,
  reviewerName: null,
};

describe("registration status", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows masked pending data and keeps the username immutable", () => {
    render(<RegistrationStatus initialData={pending} grades={[{ id: "grade-7", name: "七年级" }]} />);

    expect(screen.getByText("等待审核")).toBeInTheDocument();
    expect(screen.getByText("student-7")).toBeInTheDocument();
    expect(screen.getByText("110***********1234")).toBeInTheDocument();
    expect(screen.getByText("138****5678")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "用户名" })).not.toBeInTheDocument();
  });

  it("loads the signed-in student's own full data only when editing", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      username: "student-7",
      realName: "周同学",
  displayName: "周同学",
      nationalId: "11010519491231002X",
      gender: "FEMALE",
      school: "第一中学",
      gradeId: "grade-7",
      phone: "13812345678",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<RegistrationStatus initialData={pending} grades={[{ id: "grade-7", name: "七年级" }]} />);
    await user.click(screen.getByRole("button", { name: "修改资料" }));

    expect(await screen.findByDisplayValue("11010519491231002X")).toBeInTheDocument();
    expect(screen.getByDisplayValue("13812345678")).toBeInTheDocument();
    expect(screen.getByText("女")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/v1/registration?edit=true", expect.objectContaining({ cache: "no-store" }));
  });

  it("recalculates gender and saves pending profile changes without changing status", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        username: "student-7", displayName: "周同学", nationalId: "11010519491231002X", gender: "FEMALE",
        school: "第一中学", gradeId: "grade-7", phone: "13812345678",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<RegistrationStatus initialData={pending} grades={[{ id: "grade-7", name: "七年级" }]} />);
    await user.click(screen.getByRole("button", { name: "修改资料" }));
    const idInput = await screen.findByLabelText("身份证号");
    await user.clear(idInput);
    await user.type(idInput, "110105194912310011");
    expect(screen.getAllByText("男")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/registration", expect.objectContaining({ method: "PATCH" })));
    expect(screen.getByText("资料已保存，当前仍在等待审核。")).toBeInTheDocument();
  });

  it("shows rejection details and requires an explicit resubmission", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ submitted: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<RegistrationStatus initialData={{ ...pending, studentStatus: "REJECTED", rejectionReason: "学校信息不完整", reviewedAt: "2026-07-26T09:00:00.000Z", reviewerName: "王老师" }} grades={[{ id: "grade-7", name: "七年级" }]} />);

    expect(screen.getByText("审核未通过")).toBeInTheDocument();
    expect(screen.getByText("学校信息不完整")).toBeInTheDocument();
    expect(screen.getByText(/王老师/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新提交审核" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/registration/resubmit", expect.objectContaining({ method: "POST" })));
    expect(screen.getByText("已重新提交，请重新登录查看最新状态。")).toBeInTheDocument();
  });
});
