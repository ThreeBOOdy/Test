import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProvider } from "@/lib/server/ai/provider";

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  apiErrorResponse: vi.fn((error: unknown) => {
    const withStatus = error as { status?: number };
    const status = withStatus.status ?? (error instanceof Error && "issues" in error ? 400 : 500);
    return new Response(JSON.stringify({ message: error instanceof Error ? error.message : "error" }), { status });
  }),
  assertSameOrigin: vi.fn(),
  prepareAiTutorChat: vi.fn(),
  recordAiTutorAssistantMessage: vi.fn(),
  submitAiTutorFeedback: vi.fn(),
}));

vi.mock("@/lib/server/api", () => ({
  requireActiveStudent: mocks.requireActiveStudent,
  apiErrorResponse: mocks.apiErrorResponse,
}));
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/ai/tutor", () => ({
  prepareAiTutorChat: mocks.prepareAiTutorChat,
  recordAiTutorAssistantMessage: mocks.recordAiTutorAssistantMessage,
  submitAiTutorFeedback: mocks.submitAiTutorFeedback,
}));

import { POST as chatPOST } from "@/app/api/v1/ai/chat/route";
import { POST as feedbackPOST } from "@/app/api/v1/ai/messages/[id]/feedback/route";

const student = { id: "student-1", role: "STUDENT", capability: "FULL_STUDENT" };
const headers = { "content-type": "application/json", origin: "http://localhost", host: "localhost" };

describe("AI tutor chat route", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireActiveStudent.mockResolvedValue(student);
    mocks.assertSameOrigin.mockImplementation(() => undefined);
    mocks.recordAiTutorAssistantMessage.mockResolvedValue({ id: "msg-ai-1" });
    mocks.prepareAiTutorChat.mockImplementation(async () => ({
      conversationId: "conv-1",
      questionId: "q-1",
      isFollowUp: false,
      provider: new MockProvider({ chunks: ["提示", "内容"] }),
      messages: [{ role: "user", content: "为什么选 B？" }],
    }));
  });

  it("streams SSE meta/delta/done and records the assistant message", async () => {
    const request = new Request("http://localhost/api/v1/ai/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({ questionId: "q-1", practiceSessionId: "session-1", message: "为什么选 B？" }),
    });

    const response = await chatPOST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const text = await response.text();
    expect(text).toContain("event: meta");
    expect(text).toContain('"conversationId":"conv-1"');
    expect(text).toContain("event: delta");
    expect(text).toContain('"content":"提示"');
    expect(text).toContain('"content":"内容"');
    expect(text).toContain("event: done");
    expect(text).toContain('"messageId":"msg-ai-1"');

    expect(mocks.prepareAiTutorChat).toHaveBeenCalledWith({
      userId: "student-1",
      conversationId: undefined,
      questionId: "q-1",
      practiceSessionId: "session-1",
      message: "为什么选 B？",
    });
    expect(mocks.recordAiTutorAssistantMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "conv-1",
      userId: "student-1",
      questionId: "q-1",
      content: "提示内容",
      provider: "mock",
      model: "mock-model",
    }));
  });

  it("rejects non-students before preparing a chat", async () => {
    mocks.requireActiveStudent.mockRejectedValue(new Error("权限不足"));

    const response = await chatPOST(new Request("http://localhost/api/v1/ai/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({ questionId: "q-1", message: "为什么选 B？" }),
    }));

    expect(response.status).toBe(500);
    expect(mocks.prepareAiTutorChat).not.toHaveBeenCalled();
  });

  it("returns a JSON error for invalid input before opening SSE", async () => {
    const response = await chatPOST(new Request("http://localhost/api/v1/ai/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({ message: "" }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.prepareAiTutorChat).not.toHaveBeenCalled();
  });
});

describe("AI tutor feedback route", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireActiveStudent.mockResolvedValue(student);
    mocks.assertSameOrigin.mockImplementation(() => undefined);
    mocks.submitAiTutorFeedback.mockResolvedValue({ saved: true });
  });

  it("submits feedback for an assistant message", async () => {
    const request = new Request("http://localhost/api/v1/ai/messages/msg-ai-1/feedback", {
      method: "POST",
      headers,
      body: JSON.stringify({ feedback: "HELPFUL" }),
    });

    const response = await feedbackPOST(request, { params: Promise.resolve({ id: "msg-ai-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true });
    expect(mocks.submitAiTutorFeedback).toHaveBeenCalledWith({
      userId: "student-1",
      messageId: "msg-ai-1",
      feedback: "HELPFUL",
    });
  });

  it("rejects invalid feedback values", async () => {
    const request = new Request("http://localhost/api/v1/ai/messages/msg-ai-1/feedback", {
      method: "POST",
      headers,
      body: JSON.stringify({ feedback: "MEH" }),
    });

    const response = await feedbackPOST(request, { params: Promise.resolve({ id: "msg-ai-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.submitAiTutorFeedback).not.toHaveBeenCalled();
  });
});
