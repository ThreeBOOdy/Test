import { describe, expect, it } from "vitest";
import { parseQuestionRevisionSnapshot, STALE_VERSION_MESSAGE, toQuestionSnapshot } from "@/lib/server/question-revisions";

describe("question revisions", () => {
  it("retains the complete editable question snapshot", () => {
    const snapshot = toQuestionSnapshot({
      levelId: "level-1",
      knowledgePointId: "point-1",
      sourceBankCode: "bank",
      externalQuestionCode: "Q-1",
      stem: "原始题干",
      options: [{ id: "A", text: "正确" }, { id: "B", text: "错误" }],
      correctOptionIds: ["A"],
      status: "ACTIVE",
    });

    expect(parseQuestionRevisionSnapshot(snapshot)).toMatchObject({ stem: "原始题干", status: "ACTIVE", correctOptionIds: ["A"] });
  });

  it("rejects malformed historical snapshots instead of restoring partial data", () => {
    expect(() => parseQuestionRevisionSnapshot({ stem: "缺少必要字段" })).toThrow("题目修订数据无效");
  });

  it("uses one refresh-and-retry message for all stale versions", () => {
    expect(STALE_VERSION_MESSAGE).toBe("数据已被其他教师更新，请刷新后重试");
  });
});
