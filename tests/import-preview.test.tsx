import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ImportPreview } from "@/components/import-preview";

const levels = [
  { id: "level-a", code: "A", name: "A 级" },
  { id: "level-b", code: "B", name: "B 级" },
];

const excelPreview = {
  batchId: "batch-excel",
  fileName: "questions.xlsx",
  source: "EXCEL",
  sheetNames: ["题库"],
  stats: { totalRows: 1, validRows: 1, warningRows: 0, errorRows: 0 },
  rows: [
    {
      row: { rowNumber: 2, sheetName: "题库", externalQuestionCode: "X-1", stem: "Excel 题干", levelCode: "A", categoryCode: "4.1.1" },
      selectionSpec: "4选1",
      type: "SINGLE_CHOICE",
      issues: [],
    },
  ],
};

const wordPreview = {
  batchId: "batch-word",
  fileName: "questions.docx",
  source: "WORD",
  sheetNames: [],
  stats: { totalRows: 1, validRows: 1, warningRows: 0, errorRows: 0 },
  rows: [
    {
      row: { rowNumber: 1, locationLabel: "第 1 题", stem: "Word 题干", levelCode: "A", categoryCode: "4.1.1" },
      selectionSpec: "4选1",
      type: "SINGLE_CHOICE",
      issues: [],
    },
  ],
};

const imagePreview = {
  batchId: "batch-word",
  fileName: "questions.docx",
  source: "WORD",
  sheetNames: [],
  stats: { totalRows: 1, validRows: 1, warningRows: 0, errorRows: 0 },
  rows: [
    {
      row: { rowNumber: 1, locationLabel: "第 1 题", stem: "含图题干 [图:qimg_1]", levelCode: "A", categoryCode: "4.1.1" },
      selectionSpec: "4选1",
      type: "SINGLE_CHOICE",
      issues: [],
      images: [
        { id: "qimg_1", field: "STEM", mimeType: "image/png", sizeBytes: 10 },
        { id: "qimg_2", field: "A", mimeType: "image/png", sizeBytes: 10 },
      ],
    },
  ],
};

function mockPreview(payload: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } }),
  );
}

function docxFile() {
  return new File(["docx"], "questions.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

function xlsxFile() {
  return new File(["xlsx"], "questions.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

describe("ImportPreview", () => {
  it("shows the whole-file level and category form when a Word file is selected", async () => {
    const user = userEvent.setup();
    render(<ImportPreview levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), docxFile());

    const levelSelect = screen.getByLabelText("等级");
    expect(levelSelect.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "A级 · A 级" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "B级 · B 级" })).toBeInTheDocument();
    expect(screen.getByLabelText("分类号")).toBeInTheDocument();
    expect(screen.getByLabelText("知识点名称（可选）")).toBeInTheDocument();
    expect(screen.queryByText(/标准表头/)).not.toBeInTheDocument();
  });

  it("keeps the Excel-only view when an Excel file is selected", async () => {
    const user = userEvent.setup();
    render(<ImportPreview levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), xlsxFile());

    expect(screen.queryByLabelText("等级")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("分类号")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("知识点名称（可选）")).not.toBeInTheDocument();
    expect(screen.getByText(/标准表头/)).toBeInTheDocument();
  });

  it("submits the whole-file form for Word and shows 第 N 题 source locations", async () => {
    const fetchMock = mockPreview(wordPreview);
    const user = userEvent.setup();
    render(<ImportPreview levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), docxFile());
    await user.type(screen.getByLabelText("分类号"), "4.1.1");
    await user.type(screen.getByLabelText("知识点名称（可选）"), "力学基础");
    await user.click(screen.getByRole("button", { name: "开始预检" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
    expect(body.get("levelCode")).toBe("A");
    expect(body.get("categoryCode")).toBe("4.1.1");
    expect(body.get("knowledgePointName")).toBe("力学基础");

    await waitFor(() => expect(screen.getByText("第 1 题")).toBeInTheDocument());
    expect(screen.getByText("Word 题干")).toBeInTheDocument();
    expect(screen.getByText("来源标记：第 N 题；完整数据保存在服务器，页面仅展示前 100 行。")).toBeInTheDocument();
  });

  it("submits Excel without the whole-file fields and keeps worksheet source locations", async () => {
    const fetchMock = mockPreview(excelPreview);
    const user = userEvent.setup();
    render(<ImportPreview levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), xlsxFile());
    await user.click(screen.getByRole("button", { name: "开始预检" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
    expect(body.get("levelCode")).toBeNull();
    expect(body.get("categoryCode")).toBeNull();
    expect(body.get("knowledgePointName")).toBeNull();

    await waitFor(() => expect(screen.getByText("题库!2")).toBeInTheDocument());
    expect(screen.getByText("Excel 题干")).toBeInTheDocument();
    expect(screen.getByText("工作表：题库；完整数据保存在服务器，页面仅展示前 100 行。")).toBeInTheDocument();
  });

  it("shows the image count and thumbnails for word rows with images", async () => {
    const fetchMock = mockPreview(imagePreview);
    const user = userEvent.setup();
    render(<ImportPreview levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), docxFile());
    await user.type(screen.getByLabelText("分类号"), "4.1.1");
    await user.click(screen.getByRole("button", { name: "开始预检" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("图片 2 张")).toBeInTheDocument());
    const thumbnails = screen.getAllByRole("img");
    expect(thumbnails).toHaveLength(2);
    expect(thumbnails[0]).toHaveAttribute("src", "/api/v1/teacher/import-batches/batch-word/images/qimg_1");
    expect(thumbnails[1]).toHaveAttribute("src", "/api/v1/teacher/import-batches/batch-word/images/qimg_2");
  });
});
