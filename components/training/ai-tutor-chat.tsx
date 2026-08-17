"use client";

import { useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, ThumbsDown, ThumbsUp, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  messageId?: string;
  feedback?: "HELPFUL" | "NOT_HELPFUL" | null;
};

type SseEvent = {
  event: string;
  data: {
    content?: string;
    conversationId?: string;
    messageId?: string;
    isFollowUp?: boolean;
    message?: string;
  };
};

function parseSseEvent(raw: string): SseEvent | null {
  const lines = raw.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) as SseEvent["data"] };
  } catch {
    return null;
  }
}

export function AiTutorChat({
  questionId,
  sessionId,
  questionStem,
}: {
  questionId: string;
  sessionId?: string;
  questionStem?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const messagesRef = useRef<ChatMessage[]>([]);

  const commitMessages = (next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  };

  const appendMessage = (message: ChatMessage) => {
    commitMessages([...messagesRef.current, message]);
  };

  const updateLastAssistant = (updater: (message: ChatMessage) => ChatMessage) => {
    const current = messagesRef.current;
    if (current[current.length - 1]?.role !== "assistant") return;
    const next = [...current];
    next[next.length - 1] = updater(next[next.length - 1]);
    commitMessages(next);
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    setError("");
    appendMessage({ role: "user", content });

    setStreaming(true);
    try {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          questionId,
          ...(sessionId ? { practiceSessionId: sessionId } : {}),
          message: content,
        }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "AI 答疑请求失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const event = parseSseEvent(block);
          if (!event) continue;
          if (event.event === "meta" && event.data.conversationId) {
            setConversationId(event.data.conversationId);
          } else if (event.event === "delta" && event.data.content) {
            if (messagesRef.current[messagesRef.current.length - 1]?.role !== "assistant") {
              appendMessage({ role: "assistant", content: "" });
            }
            updateLastAssistant((message) => ({ ...message, content: message.content + (event.data.content ?? "") }));
          } else if (event.event === "done") {
            updateLastAssistant((message) => ({ ...message, messageId: event.data.messageId }));
          } else if (event.event === "error") {
            throw new Error(event.data.message ?? "AI 答疑服务暂时不可用");
          }
        }
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "AI 答疑服务暂时不可用";
      setError(message);
      appendMessage({ role: "assistant", content: `抱歉，答疑失败：${message}` });
    } finally {
      setStreaming(false);
    }
  };

  const submitFeedback = async (messageId: string, feedback: "HELPFUL" | "NOT_HELPFUL") => {
    setError("");
    try {
      const response = await fetch(`/api/v1/ai/messages/${messageId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "反馈提交失败");
      }
      const current = messagesRef.current.map((message) =>
        message.messageId === messageId ? { ...message, feedback } : message,
      );
      commitMessages(current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "反馈提交失败");
    }
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0"
        aria-label="问 AI"
      >
        <MessageCircle className="size-4" />
        问 AI
      </Button>
    );
  }

  return (
    <Card className="mt-3 w-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-[var(--primary)]" />
          <span className="text-sm font-bold">AI 答疑教练</span>
        </div>
        {questionStem ? <p className="hidden max-w-md truncate text-xs text-[var(--muted-foreground)] sm:block">{questionStem}</p> : null}
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="关闭 AI 答疑">
          <X className="size-4" />
        </Button>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto bg-[var(--surface)] p-4">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">
            这道题答错了，可以先向 AI 教练提问。首次回复会先给提示，追问后可以得到更完整的解析。
          </p>
        ) : null}
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
              message.role === "user"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)]",
            )}>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted-foreground)]">
                {message.role === "user" ? <User className="size-3" /> : <Bot className="size-3" />}
                {message.role === "user" ? "我" : "AI 教练"}
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.role === "assistant" && message.messageId ? (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-[var(--muted-foreground)]">有帮助吗？</span>
                  <Button type="button" variant="ghost" size="sm" className={cn("h-8 min-h-8 px-2", message.feedback === "HELPFUL" && "text-emerald-400")} onClick={() => void submitFeedback(message.messageId!, "HELPFUL")} aria-label="有帮助">
                    <ThumbsUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className={cn("h-8 min-h-8 px-2", message.feedback === "NOT_HELPFUL" && "text-rose-400")} onClick={() => void submitFeedback(message.messageId!, "NOT_HELPFUL")} aria-label="没帮助">
                    <ThumbsDown className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {streaming ? (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="size-4 animate-spin" />
            AI 正在思考…
          </div>
        ) : null}
        {error ? <p role="alert" className="text-sm text-rose-400">{error}</p> : null}
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--surface-soft)] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            rows={2}
            placeholder="继续追问，或输入“请完整解析”…"
            className="min-h-11 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
          <Button type="button" onClick={() => void sendMessage()} disabled={streaming || !input.trim()} aria-label="发送">
            {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
