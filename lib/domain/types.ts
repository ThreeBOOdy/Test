export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
export type QuestionStatus = "ACTIVE" | "DISABLED" | "ARCHIVED";
export type PracticeMode = "LEVEL_COMPREHENSIVE" | "KNOWLEDGE_POINT" | "WRONG_QUESTION";

export type QuestionOption = {
  id: string;
  text: string;
};

export type Question = {
  id: string;
  levelId: string;
  knowledgePointId: string;
  sourceBankCode?: string;
  externalQuestionCode?: string;
  stem: string;
  type: QuestionType;
  optionCount: number;
  correctOptionCount: number;
  selectionSpec: string;
  options: QuestionOption[];
  correctOptionIds: string[];
  status: QuestionStatus;
};

export type KnowledgePoint = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  path: string;
  depth: number;
  sortOrder: number;
  enabled: boolean;
};

export type Level = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
};

export type PracticeRule = {
  singleCount: number;
  multipleCount: number;
};

export type ImportQuestionRow = {
  rowNumber: number;
  levelCode: string;
  sourceBankCode?: string;
  categoryCode: string;
  knowledgePointName?: string;
  externalQuestionCode?: string;
  stem: string;
  rawAnswer: string;
  declaredSelectionSpec?: string;
  optionValues: Record<string, string | undefined>;
  enabled?: boolean;
};

export type ValidationIssue = {
  severity: "warning" | "error";
  field: string;
  message: string;
};

export type ValidatedQuestionRow = {
  row: ImportQuestionRow;
  options: QuestionOption[];
  correctOptionIds: string[];
  optionCount: number;
  correctOptionCount: number;
  selectionSpec: string;
  type: QuestionType;
  issues: ValidationIssue[];
};
export type PublicQuestion = Omit<Question, "correctOptionIds" | "status"> & {
  knowledgeName: string;
  levelCode: string;
};

export type PublicAnswerResult = {
  isCorrect: boolean;
  correctOptionIds: string[];
  selectedOptionIds: string[];
  answeredCount: number;
  correctCount: number;
};

export type PublicPracticeSession = {
  id: string;
  mode: PracticeMode;
  title: string;
  total: number;
  questions: PublicQuestion[];
  initialResults: Record<string, PublicAnswerResult>;
};