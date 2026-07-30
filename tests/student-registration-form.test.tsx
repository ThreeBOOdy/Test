import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentRegistrationForm } from "@/components/student-registration-form";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

const grades = { grades: [{ id: "g7", name: "七年级" }] };
const people = { people: [{ id: "radio-person-001", username: "radio-001", name: "无线电贡献者 001", profile: "示例人物资料" }] };

function mockInitialLoads() {
  return vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(grades), { status: 200, headers: { "Content-Type": "application/json" } }))
    .mockResolvedValueOnce(new Response(JSON.stringify(people), { status: 200, headers: { "Content-Type": "application/json" } }));
}

describe("student registration form", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads real-name details, derives gender, and hides the login username", async () => {
    mockInitialLoads();
    const user = userEvent.setup();
    render(<StudentRegistrationForm />);

    expect(await screen.findByRole("option", { name: "七年级" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("身份证号"), "11010519491231002X");
    expect(screen.getByText("女")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "用户名" })).not.toBeInTheDocument();
    expect(screen.getByText("仅用于实名审核，不作为登录用户名")).toBeInTheDocument();
  });

  it("validates password confirmation before showing person selection", async () => {
    mockInitialLoads();
    const user = userEvent.setup();
    render(<StudentRegistrationForm />);
    await screen.findByRole("option", { name: "七年级" });
    await fillProfile(user, { confirmPassword: "Different2026" });
    await user.click(screen.getByRole("button", { name: "下一步：选择人物身份" }));
    expect(screen.getByRole("alert")).toHaveTextContent("两次输入的密码不一致");
  });

  it("allows returning to change profile details before confirming a person", async () => {
    mockInitialLoads();
    const user = userEvent.setup();
    render(<StudentRegistrationForm />);
    await screen.findByRole("option", { name: "七年级" });
    await fillProfile(user);
    await user.click(screen.getByRole("checkbox", { name: /信息真实/ }));
    await user.click(screen.getByRole("button", { name: "下一步：选择人物身份" }));
    expect(await screen.findByText("选择无线电人物身份")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返回修改实名资料" }));
    expect(screen.getByLabelText("真实姓名")).toHaveValue("张三");
  });

  it("submits the selected immutable person identity and moves to restricted status", async () => {
    const fetchMock = mockInitialLoads()
      .mockResolvedValueOnce(new Response(JSON.stringify({ registered: true }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<StudentRegistrationForm />);
    await screen.findByRole("option", { name: "七年级" });
    await fillProfile(user);
    await user.click(screen.getByRole("checkbox", { name: /信息真实/ }));
    await user.click(screen.getByRole("button", { name: "下一步：选择人物身份" }));
    await user.click(screen.getByText("无线电贡献者 001"));
    await user.click(screen.getByRole("button", { name: "确认人物并提交申请" }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/auth/register", expect.objectContaining({ method: "POST" })));
    const request = fetchMock.mock.calls.at(-1)?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({ realName: "张三", password: "Student2026", radioPersonId: "radio-person-001" });
    expect(JSON.parse(String(request?.body))).not.toHaveProperty("username");
    expect(replace).toHaveBeenCalledWith("/registration/status");
  });

  it("shows an explicit reselection message when a person is concurrently claimed", async () => {
    const fetchMock = mockInitialLoads()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "该人物身份刚被其他同学确认，请重新选择" }), { status: 409, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ people: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<StudentRegistrationForm />);
    await screen.findByRole("option", { name: "七年级" });
    await fillProfile(user);
    await user.click(screen.getByRole("checkbox", { name: /信息真实/ }));
    await user.click(screen.getByRole("button", { name: "下一步：选择人物身份" }));
    await user.click(screen.getByText("无线电贡献者 001"));
    await user.click(screen.getByRole("button", { name: "确认人物并提交申请" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("该人物身份刚被其他同学确认，请重新选择");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/radio-people", expect.anything()));
  });
});

async function fillProfile(user: ReturnType<typeof userEvent.setup>, overrides: { confirmPassword?: string } = {}) {
  await user.type(screen.getByLabelText("真实姓名"), "张三");
  await user.type(screen.getByLabelText("身份证号"), "11010519491231002X");
  await user.type(screen.getByLabelText("学校"), "示例中学");
  await user.selectOptions(screen.getByLabelText("年级"), "g7");
  await user.type(screen.getByLabelText("手机号"), "13800138000");
  await user.type(screen.getByLabelText("密码"), "Student2026");
  await user.type(screen.getByLabelText("确认密码"), overrides.confirmPassword ?? "Student2026");
}