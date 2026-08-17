import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiTutorChat } from "@/components/training/ai-tutor-chat";

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function chatSseBody(conversationId: string, messageId: string, chunks: string[] = ["先想想", "中继台"]) {
  return [
    `event: meta\ndata: ${JSON.stringify({ conversationId, isFollowUp: false })}\n\n`,
    ...chunks.map((content) => `event: delta\ndata: ${JSON.stringify({ content })}\n\n`),
    `event: done\ndata: ${JSON.stringify({ conversationId, messageId })}\n\n`,
  ];
}

describe("AiTutorChat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the panel, sends a message, renders streamed assistant reply, and submits feedback", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(sseResponse(chatSseBody("conv-1", "msg-ai-1")))
      .mockResolvedValueOnce(sseResponse(chatSseBody("conv-1", "msg-ai-2", ["完整", "解析"])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const user = userEvent.setup();
    render(<AiTutorChat questionId="q-1" sessionId="session-1" questionStem="中继台下行频率？" />);

    await user.click(screen.getByRole("button", { name: "问 AI" }));
    expect(screen.getByText(/这道题答错了/)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/继续追问/);
    await user.type(input, "为什么选 B？");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(screen.getByText("为什么选 B？")).toBeInTheDocument());
    expect(await screen.findByText("先想想中继台")).toBeInTheDocument();

    const chatCall = fetchMock.mock.calls.find((call) => call[0] === "/api/v1/ai/chat")?.[1] as RequestInit;
    const chatBody = JSON.parse(String(chatCall.body)) as Record<string, unknown>;
    expect(chatBody).toMatchObject({
      questionId: "q-1",
      practiceSessionId: "session-1",
      message: "为什么选 B？",
    });
    expect(chatBody).not.toHaveProperty("conversationId");

    await user.type(input, "请完整解析");
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(screen.getByText("请完整解析")).toBeInTheDocument());
    expect(await screen.findByText("完整解析")).toBeInTheDocument();

    const chatCalls = fetchMock.mock.calls.filter((call) => call[0] === "/api/v1/ai/chat");
    expect(chatCalls).toHaveLength(2);
    const followUpBody = JSON.parse(String(chatCalls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(followUpBody).toMatchObject({
      conversationId: "conv-1",
      questionId: "q-1",
      practiceSessionId: "session-1",
      message: "请完整解析",
    });

    await user.click(screen.getAllByRole("button", { name: "有帮助" })[0] as HTMLElement);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/ai/messages/msg-ai-1/feedback", expect.objectContaining({ method: "POST" })));
    const feedbackCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/feedback"))?.[1] as RequestInit;
    expect(JSON.parse(String(feedbackCall.body))).toEqual({ feedback: "HELPFUL" });
  });

  it("shows an inline error message when the chat request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ message: "今日次数已用完" }), { status: 429, headers: { "Content-Type": "application/json" } }));

    const user = userEvent.setup();
    render(<AiTutorChat questionId="q-1" />);

    await user.click(screen.getByRole("button", { name: "问 AI" }));
    await user.type(screen.getByPlaceholderText(/继续追问/), "为什么选 B？");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("今日次数已用完");
  });
});
