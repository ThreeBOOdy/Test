import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentRegistrationForm } from "@/components/student-registration-form";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

describe("student registration form", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads enabled grades and derives gender from the identity number", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ grades: [{ id: "g7", name: "七年级" }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<StudentRegistrationForm />);

    expect(await screen.findByRole("option", { name: "七年级" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("身份证号"), "11010519491231002X");
    expect(screen.getByText("女")).toBeInTheDocument();
  });

  it("validates password confirmation before submission", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ grades: [{ id: "g7", name: "七年级" }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<StudentRegistrationForm />);
    await screen.findByRole("option", { name: "七年级" });
    await fillForm(user, { confirmPassword: "Different2026" });
    await user.click(screen.getByRole("button", { name: "提交注册申请" }));
    expect(screen.getByRole("alert")).toHaveTextContent("两次输入的密码不一致");
  });

  it("submits the form and moves to the restricted status page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ grades: [{ id: "g7", name: "七年级" }] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ registered: true }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<StudentRegistrationForm />);
    await screen.findByRole("option", { name: "七年级" });
    await fillForm(user);
    await user.click(screen.getByRole("checkbox", { name: /信息真实/ }));
    await user.click(screen.getByRole("button", { name: "提交注册申请" }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/auth/register", expect.objectContaining({ method: "POST" })));
    expect(replace).toHaveBeenCalledWith("/registration/status");
  });

  it("shows a safe conflict message without naming the duplicated field", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ grades: [{ id: "g7", name: "七年级" }] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "注册信息已存在，请核对后重试" }), { status: 409, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<StudentRegistrationForm />);
    await screen.findByRole("option", { name: "七年级" });
    await fillForm(user);
    await user.click(screen.getByRole("checkbox", { name: /信息真实/ }));
    await user.click(screen.getByRole("button", { name: "提交注册申请" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("注册信息已存在，请核对后重试");
  });
});

async function fillForm(user: ReturnType<typeof userEvent.setup>, overrides: { confirmPassword?: string } = {}) {
  await user.type(screen.getByLabelText("用户名"), "student_2026");
  await user.type(screen.getByLabelText("姓名"), "张三");
  await user.type(screen.getByLabelText("身份证号"), "11010519491231002X");
  await user.type(screen.getByLabelText("学校"), "示例中学");
  await user.selectOptions(screen.getByLabelText("年级"), "g7");
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.type(screen.getByLabelText("密码"), "Student2026");
  await user.type(screen.getByLabelText("确认密码"), overrides.confirmPassword ?? "Student2026");
}
