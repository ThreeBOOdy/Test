import type { QuestionOption, QuestionType } from "@/lib/domain/types";

const OPTION_IDS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export type QuestionEditorInput = {
  options: QuestionOption[];
  correctOptionIds: string[];
};

export function normalizeQuestionEditorInput(input: QuestionEditorInput) {
  const options = input.options
    .map((option) => ({ id: option.id.trim().toUpperCase(), text: option.text.trim() }))
    .filter((option) => option.text.length > 0);

  if (options.length < 2) throw new Error("至少需要两个有效选项");
  if (options.length > OPTION_IDS.length) throw new Error("最多支持 8 个选项");

  const optionIds = options.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length) throw new Error("选项编号不能重复");
  const expectedOptionIds = OPTION_IDS.slice(0, options.length);
  if (optionIds.some((optionId, index) => optionId !== expectedOptionIds[index])) {
    throw new Error(`选项必须从 A 开始连续填写，例如 ${expectedOptionIds.join("、")}`);
  }

  const correctOptionIds = [...new Set(input.correctOptionIds.map((item) => item.trim().toUpperCase()).filter(Boolean))]
    .sort((left, right) => optionIds.indexOf(left) - optionIds.indexOf(right));
  if (correctOptionIds.length === 0) throw new Error("标准答案不能为空");
  if (correctOptionIds.some((optionId) => !optionIds.includes(optionId))) throw new Error("标准答案包含不存在的选项");
  if (correctOptionIds.length >= options.length) throw new Error("至少需要保留一个错误选项");

  const correctOptionCount = correctOptionIds.length;
  const type: QuestionType = correctOptionCount === 1 ? "SINGLE_CHOICE" : "MULTIPLE_CHOICE";
  return {
    options,
    correctOptionIds,
    optionCount: options.length,
    correctOptionCount,
    selectionSpec: `${options.length}选${correctOptionCount}`,
    type,
  };
}