import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportPreview } from "@/components/import-preview";

const knowledgePointTypes = [
  { id: "type-dg", code: "DG", name: "电工基础", enabled: true },
  { id: "type-tx", code: "TX", name: "通信原理", enabled: true },
  { id: "type-disabled", code: "OLD", name: "已停用类型", enabled: false },
];

const levels = [
  { id: "level-a", code: "A", name: "基础掌握", enabled: true },
  { id: "level-k", code: "K", name: "K 类综合", enabled: true },
];

const excelPreview = {
  batchId: "batch-excel",
  fileName: "questions.xlsx",
  source: "EXCEL",
  sheetNames: ["题库"],
  stats: { totalRows: 1, validRows: 1, warningRows: 0, errorRows: 0 },
  rows: [
    {
      row: { rowNumber: 2, sheetName: "题库", externalQuestionCode: "X-1", stem: "Excel 题干", categoryCode: "4.1.1" },
      selectionSpec: "4选1",
      type: "SINGLE_CHOICE",
      issues: [],
    },
  ],
};

const multiSheetExcelPreview = {
  ...excelPreview,
  batchId: "batch-multi",
  sheetNames: ["电工基础", "通信原理"],
  rows: [
    {
      row: { rowNumber: 2, sheetName: "电工基础", externalQuestionCode: "X-1", stem: "Excel 题干", categoryCode: "4.1.1" },
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
      row: { rowNumber: 1, locationLabel: "第 1 题", stem: "Word 题干", categoryCode: "4.1.1" },
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
      row: { rowNumber: 1, locationLabel: "第 1 题", stem: "含图题干 [图:qimg_1]", categoryCode: "4.1.1" },
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

function mockFetch(routes: Record<string, unknown>, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const payload = Object.entries(routes).find(([key]) => url.includes(key))?.[1] ?? routes.default;
    if (payload === undefined) {
      return new Response(JSON.stringify({ message: "not mocked" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
  });
}

function docxFile() {
  return new File(["docx"], "questions.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

function xlsxFile() {
  return new File(["xlsx"], "questions.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ImportPreview (S9)", () => {
  it("shows the whole-file wizard when a Word file is selected", async () => {
    const user = userEvent.setup();
    render(<ImportPreview knowledgePointTypes={knowledgePointTypes} levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), docxFile());

    expect(screen.queryByLabelText("等级")).not.toBeInTheDocument();
    expect(screen.getByLabelText("大类知识点（类型）")).toBeInTheDocument();
    expect(screen.getByLabelText("分类号")).toBeInTheDocument();
    expect(screen.getByLabelText("知识点名称（可选）")).toBeInTheDocument();
    expect(screen.queryByText(/标准表头/)).not.toBeInTheDocument();
  });

  it("keeps the Excel-only view before preview and shows the single-sheet wizard after preview", async () => {
    const fetchMock = mockFetch({ default: excelPreview });
    const user = userEvent.setup();
    render(<ImportPreview knowledgePointTypes={knowledgePointTypes} levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), xlsxFile());

    expect(screen.queryByLabelText("等级")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("分类号")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("知识点名称（可选）")).not.toBeInTheDocument();
    expect(screen.getByText(/标准表头/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "开始预检" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
    expect(body.get("levelCode")).toBeNull();
    expect(body.get("categoryCode")).toBeNull();
    expect(body.get("knowledgePointName")).toBeNull();

    await waitFor(() => expect(screen.getByText("单 sheet 导入向导")).toBeInTheDocument());
    expect(screen.getByText("题库!2")).toBeInTheDocument();
    expect(screen.getByText("Excel 题干")).toBeInTheDocument();
    expect(screen.getByText("工作表：题库；完整数据保存在服务器，页面仅展示前 100 行。")).toBeInTheDocument();
  });

  it("applies the single-sheet wizard type and category override before commit", async () => {
    const fetchMock = mockFetch({ default: excelPreview });
    const user = userEvent.setup();
    render(<ImportPreview knowledgePointTypes={knowledgePointTypes} levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), xlsxFile());
    await user.click(screen.getByRole("button", { name: "开始预检" }));
    await waitFor(() => expect(screen.getByText("单 sheet 导入向导")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("大类知识点（类型）"), "type-dg");
    await user.type(screen.getByLabelText("分类号（可选覆盖）"), "2.1");
    await user.type(screen.getByLabelText("知识点名称（可选覆盖）"), "覆盖名称");
    await user.click(screen.getByRole("button", { name: "应用向导并重新预检" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = fetchMock.mock.calls[1][1]?.body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
    expect(body.get("knowledgePointTypeId")).toBe("type-dg");
    expect(body.get("knowledgePointTypeCode")).toBe("DG");
    expect(body.get("knowledgePointTypeName")).toBe("电工基础");
    expect(body.get("categoryCode")).toBe("2.1");
    expect(body.get("knowledgePointName")).toBe("覆盖名称");

    await waitFor(() => expect(screen.getByText(/已应用向导：将导入到「电工基础」/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "确认导入 1 道题" })).toBeEnabled();
  });

  it("submits the whole-file wizard for Word and shows 第 N 题 source locations", async () => {
    const fetchMock = mockFetch({ default: wordPreview });
    const user = userEvent.setup();
    render(<ImportPreview knowledgePointTypes={knowledgePointTypes} levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), docxFile());
    await user.selectOptions(screen.getByLabelText("大类知识点（类型）"), "type-dg");
    await user.type(screen.getByLabelText("分类号"), "4.1.1");
    await user.type(screen.getByLabelText("知识点名称（可选）"), "力学基础");
    await user.click(screen.getByRole("button", { name: "开始预检" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
    expect(body.get("levelCode")).toBeNull();
    expect(body.get("categoryCode")).toBe("4.1.1");
    expect(body.get("knowledgePointName")).toBe("力学基础");
    expect(body.get("knowledgePointTypeId")).toBe("type-dg");
    expect(body.get("knowledgePointTypeCode")).toBe("DG");
    expect(body.get("knowledgePointTypeName")).toBe("电工基础");

    await waitFor(() => expect(screen.getByText("第 1 题")).toBeInTheDocument());
    expect(screen.getByText("Word 题干")).toBeInTheDocument();
    expect(screen.getByText("来源标记：第 N 题；完整数据保存在服务器，页面仅展示前 100 行。")).toBeInTheDocument();
  });

  it("shows multi-sheet auto-detection and does not show the single-sheet wizard", async () => {
    const fetchMock = mockFetch({ default: multiSheetExcelPreview });
    const user = userEvent.setup();
    render(<ImportPreview knowledgePointTypes={knowledgePointTypes} levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), xlsxFile());
    await user.click(screen.getByRole("button", { name: "开始预检" }));

    await waitFor(() => expect(screen.getByText("多 sheet 自动识别")).toBeInTheDocument());
    expect(screen.getByText(/提交时将按工作表名自动创建\/匹配知识点类型：电工基础、通信原理/)).toBeInTheDocument();
    expect(screen.queryByText("单 sheet 导入向导")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[0][1]?.body as FormData).toBeDefined();
    expect(screen.getByRole("button", { name: "确认导入 1 道题" })).toBeEnabled();
  });

  it("shows the image count and thumbnails for word rows with images", async () => {
    const fetchMock = mockFetch({ default: imagePreview });
    const user = userEvent.setup();
    render(<ImportPreview knowledgePointTypes={knowledgePointTypes} levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), docxFile());
    await user.selectOptions(screen.getByLabelText("大类知识点（类型）"), "type-dg");
    await user.type(screen.getByLabelText("分类号"), "4.1.1");
    await user.click(screen.getByRole("button", { name: "开始预检" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("图片 2 张")).toBeInTheDocument());
    const thumbnails = screen.getAllByRole("img");
    expect(thumbnails).toHaveLength(2);
    expect(thumbnails[0]).toHaveAttribute("src", "/api/v1/teacher/import-batches/batch-word/images/qimg_1");
    expect(thumbnails[1]).toHaveAttribute("src", "/api/v1/teacher/import-batches/batch-word/images/qimg_2");
  });

  it("opens the letter-class classification wizard after commit and assigns the selected levels", async () => {
    const fetchMock = mockFetch({
      default: wordPreview,
      "/api/v1/teacher/imports/commit": { batchId: "batch-word", inserted: 2, skipped: 0, questionIds: ["q1", "q2"] },
      "/api/v1/teacher/questions/levels/batch": { assigned: 4, skippedDuplicates: 0 },
    });
    const user = userEvent.setup();
    render(<ImportPreview knowledgePointTypes={knowledgePointTypes} levels={levels} />);

    await user.upload(screen.getByLabelText("选择 .xlsx 或 .docx 文件"), docxFile());
    await user.selectOptions(screen.getByLabelText("大类知识点（类型）"), "type-dg");
    await user.type(screen.getByLabelText("分类号"), "4.1.1");
    await user.click(screen.getByRole("button", { name: "开始预检" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认导入 1 道题" })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "确认导入 1 道题" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "字母类归类向导" })).toBeInTheDocument());

    await user.click(screen.getByRole("checkbox", { name: "字母类 A" }));
    await user.click(screen.getByRole("checkbox", { name: "字母类 K" }));
    await user.click(screen.getByRole("button", { name: "拉取到所选字母类" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/teacher/questions/levels/batch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ questionIds: ["q1", "q2"], levelIds: ["level-a", "level-k"] }),
      }),
    ));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "字母类归类向导" })).not.toBeInTheDocument());
    expect(screen.getByText("已拉取到 A级、K级，共 4 条关联。")).toBeInTheDocument();
  });
});
