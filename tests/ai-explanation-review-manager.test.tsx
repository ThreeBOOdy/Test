import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiExplanationReviewManager, type ExplanationReviewRow } from "@/components/ai-explanation-review-manager";

const row: ExplanationReviewRow = {
  id: "q-1",
  externalQuestionCode: "EX-1",
  stem: "中继台下行频率应避开哪些业务频率？",
  type: "SINGLE_CHOICE",
  explanationStatus: "DRAFT",
  explanationVersion: 1,
  explanationRejectReason: null,
  explanation: { summary: "一句话", knowledge: "讲解", memory: "口诀" },
  updatedAt: "2026-08-17T00:00:00.000Z",
  reviewedAt: null,
  reviewedByName: null,
  level: { id: "level-1", code: "A", name: "A Level" },
  knowledgePoint: { id: "point-1", code: "1.1", name: "中继台频率" },
};

const detail = {
  ...row,
  sourceBankCode: null,
  options: [
    { id: "A", text: "广播电视业务" },
    { id: "B", text: "航空移动业务" },
    { id: "C", text: "水上移动业务" },
  ],
  correctOptionIds: ["B"],
  selectionSpec: "3选1",
  version: 2,
  reviewedById: null,
};

describe("AiExplanationReviewManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a review modal with editable explanation and submits modified approval", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true, status: "APPROVED", version: 3, explanationVersion: 2 }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<AiExplanationReviewManager rows={[row]} />);

    await user.click(screen.getByRole("button", { name: "审核" }));
    expect(await screen.findByRole("heading", { name: "AI 解析审核" })).toBeInTheDocument();
    const summary = screen.getByLabelText("一句话解析") as HTMLTextAreaElement;
    expect(summary.value).toBe("一句话");
    await user.clear(summary);
    await user.type(summary, "新的一句话");
    await user.click(screen.getByRole("button", { name: "修改后通过" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/teacher/ai-explanations/q-1/review", expect.objectContaining({ method: "POST" })));
    const request = fetchMock.mock.calls.find((call) => call[0] === "/api/v1/teacher/ai-explanations/q-1/review")?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      action: "APPROVE_WITH_EDITS",
      version: 2,
      content: { summary: "新的一句话", knowledge: "讲解", memory: "口诀" },
    });
  });

  it("submits a rejection with reason", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true, status: "REJECTED", version: 3, explanationVersion: 2 }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<AiExplanationReviewManager rows={[row]} />);

    await user.click(screen.getByRole("button", { name: "审核" }));
    await screen.findByRole("heading", { name: "AI 解析审核" });
    await user.type(screen.getByLabelText("驳回原因"), "不够准确");
    await user.click(screen.getByRole("button", { name: "驳回" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/teacher/ai-explanations/q-1/review", expect.objectContaining({ method: "POST" })));
    const request = fetchMock.mock.calls.find((call) => call[0] === "/api/v1/teacher/ai-explanations/q-1/review")?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      action: "REJECT",
      version: 2,
      rejectReason: "不够准确",
    });
  });
});
