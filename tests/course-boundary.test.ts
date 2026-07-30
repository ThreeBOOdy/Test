import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RADIO_COURSE_ID } from "../lib/domain/course";

const mocks = vi.hoisted(() => ({
  requireTeachingUser: vi.fn(),
  writeAuditLog: vi.fn(),
  levelFindFirst: vi.fn(),
  knowledgePointFindFirst: vi.fn(),
  questionFindFirst: vi.fn(),
  questionCreate: vi.fn(),
  questionCount: vi.fn(),
  levelRuleUpsert: vi.fn(),
  knowledgeRuleDeleteMany: vi.fn(),
  knowledgeRuleUpsert: vi.fn(),
  examRuleUpsert: vi.fn(),
  importBatchCreate: vi.fn(),
  importBatchRowCreateMany: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireTeachingUser: mocks.requireTeachingUser };
});
vi.mock("@/lib/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/db", () => {
  const transaction = {
    levelPracticeRule: { upsert: mocks.levelRuleUpsert },
    knowledgePracticeRule: { deleteMany: mocks.knowledgeRuleDeleteMany, upsert: mocks.knowledgeRuleUpsert },
    examRule: { upsert: mocks.examRuleUpsert },
    importBatch: { create: mocks.importBatchCreate },
    importBatchRow: { createMany: mocks.importBatchRowCreateMany },
  };
  return {
    prisma: {
      level: { findFirst: mocks.levelFindFirst },
      knowledgePoint: { findFirst: mocks.knowledgePointFindFirst },
      question: { findFirst: mocks.questionFindFirst, create: mocks.questionCreate, count: mocks.questionCount },
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    },
  };
});

import { POST as createQuestion } from "@/app/api/v1/admin/questions/route";
import { PUT as savePracticeRules } from "@/app/api/v1/admin/practice-rules/route";
import { POST as previewImport } from "@/app/api/v1/imports/preview/route";

describe("radio course boundary", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireTeachingUser.mockResolvedValue({ id: "teacher-1" });
    mocks.levelFindFirst.mockResolvedValue({ id: "level-radio", enabled: true });
    mocks.knowledgePointFindFirst.mockResolvedValue({ id: "point-radio", enabled: true, _count: { children: 0 } });
    mocks.questionFindFirst.mockResolvedValue(null);
    mocks.questionCreate.mockResolvedValue({ id: "question-radio" });
    mocks.questionCount.mockResolvedValue(10);
    mocks.importBatchCreate.mockResolvedValue({ id: "batch-radio", status: "PREVIEW" });
    mocks.importBatchRowCreateMany.mockResolvedValue({ count: 1 });
  });

  it("ignores a forged course when creating a question", async () => {
    const response = await createQuestion(jsonRequest("http://localhost/api/v1/admin/questions", "POST", {
      courseId: "course-python",
      levelId: "level-radio",
      knowledgePointId: "point-radio",
      externalQuestionCode: "Q-1",
      stem: "题目",
      options: [{ id: "A", text: "A" }, { id: "B", text: "B" }],
      correctOptionIds: ["A"],
      status: "ACTIVE",
    }));

    expect(response.status).toBe(201);
    expect(mocks.questionCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ courseId: RADIO_COURSE_ID }) });
  });

  it("ignores forged courses when saving practice rules", async () => {
    const response = await savePracticeRules(jsonRequest("http://localhost/api/v1/admin/practice-rules", "PUT", {
      courseId: "course-python",
      levelRules: [{ courseId: "course-python", levelId: "level-radio", singleCount: 1, multipleCount: 0 }],
      knowledgeRules: [],
      examRules: [],
    }));

    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(mocks.levelRuleUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { courseId_levelId: { courseId: RADIO_COURSE_ID, levelId: "level-radio" } },
      create: expect.objectContaining({ courseId: RADIO_COURSE_ID }),
    }));
  });

  it("ignores a forged course when creating an import batch", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("题库");
    sheet.addRow(["等级", "分类号", "问题", "答案", "A", "B"]);
    sheet.addRow(["A", "1.1", "题目", "A", "正确", "错误"]);
    const buffer = await workbook.xlsx.writeBuffer();
    const file = new File([buffer], "questions.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => buffer });
    const request = new Request("http://localhost/api/v1/imports/preview", {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost" },
    });
    Object.defineProperty(request, "formData", { value: async () => ({ get: (key: string) => key === "file" ? file : key === "courseId" ? "course-python" : null }) });
    const response = await previewImport(request);

    const body = await response.clone().json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(mocks.importBatchCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ courseId: RADIO_COURSE_ID }) });
  });

  it("defines a lossless migration to the single enabled RADIO course", () => {
    const migration = fs.readFileSync(path.resolve("prisma/migrations/20260730120000_radio_course_boundary/migration.sql"), "utf8");

    expect(migration).toContain("CREATE TABLE `Course`");
    expect(migration).toContain("'course-radio', 'RADIO', '无线电课程', true, 1");
    expect(migration).toContain("UNIQUE INDEX `Course_activeSlot_key`");
    expect(migration).toContain("CONSTRAINT `Course_enabled_active_slot_check`");
    expect(migration).toContain("(`enabled` = true AND `activeSlot` = 1)");
    expect(migration).not.toContain("CourseBoundary");
    expect(migration).not.toContain("Course_radio_activation_check");
    for (const table of ["Level", "KnowledgePoint", "ExamRule", "LevelPracticeRule", "KnowledgePracticeRule", "Question", "PracticeSession", "PracticeSessionQuestion", "PracticeAnswer", "WrongQuestion", "ImportBatch"]) {
      expect(migration).toContain(`UPDATE \`${table}\` SET \`courseId\` = 'course-radio' WHERE \`courseId\` IS NULL`);
      expect(migration).toContain(`ALTER TABLE \`${table}\` MODIFY \`courseId\` VARCHAR(191) NOT NULL DEFAULT 'course-radio'`);
      expect(migration).toContain(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${table}_courseId_fkey\``);
    }
    expect(migration).toContain("FOREIGN KEY (`courseId`, `sessionId`) REFERENCES `PracticeSession`(`courseId`, `id`)");
    expect(migration).toContain("FOREIGN KEY (`courseId`, `questionId`) REFERENCES `Question`(`courseId`, `id`)");
    expect(migration).toContain("DROP INDEX `KnowledgePoint_path_idx` ON `KnowledgePoint`");
  });
});

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: JSON.stringify(body),
  });
}
