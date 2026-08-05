import type { DocxImage } from "./docx-content";

export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
export type QuestionStatus = "ACTIVE" | "DISABLED" | "ARCHIVED";
export type PracticeMode = "LEVEL_COMPREHENSIVE" | "KNOWLEDGE_POINT" | "WRONG_QUESTION" | "QUESTION_ORDER" | "RANDOM_ALL" | "MOCK_EXAM";
export type PracticeStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type ExamSettlementSource = "STUDENT_SUBMISSION" | "AUTO_SETTLEMENT";

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
  preserveOptionOrder?: boolean;
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
  version?: number;
};

export type ExamRule = PracticeRule & {
  durationMinutes: number;
  passingCount: number;
};

export type ImportQuestionRow = {
  rowNumber: number;
  locationLabel?: string;
  sheetName?: string;
  levelCode: string;
  sourceBankCode?: string;
  categoryCode: string;
  knowledgePointName?: string;
  externalQuestionCode?: string;
  stem: string;
  rawAnswer: string;
  declaredSelectionSpec?: string;
  preserveOptionOrder?: boolean;
  explanation?: string;
  /** Word 含图导入时归属题干段的图片（文档顺序）。 */
  stemImages?: DocxImage[];
  /** Word 含图导入时归属具体选项的图片，键为选项编号（A–H）。 */
  optionImages?: Record<string, DocxImage[]>;
  /** 题干逐行文本与其图片（行内顺序），用于把图片标记嵌入题干文本。 */
  stemLines?: Array<{ text: string; images: DocxImage[] }>;
  /** 选项逐行文本与其图片（行内顺序），键为选项编号（A–H）。 */
  optionLines?: Record<string, Array<{ text: string; images: DocxImage[] }>>;
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
export type PublicQuestion = Omit<Question, "correctOptionIds" | "status" | "correctOptionCount" | "selectionSpec"> & {
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

export type PublicExamDraft = {
  answers: Record<string, string[]>;
  currentIndex: number;
  version: number;
  updatedAt: string;
};

export type PublicExamResult = {
  correctCount: number;
  total: number;
  passingCount: number;
  passed: boolean;
  settlementSource: ExamSettlementSource;
  completedAt: string;
};

export type PublicPracticeSession = {
  id: string;
  mode: PracticeMode;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  title: string;
  total: number;
  questions: PublicQuestion[];
  initialResults: Record<string, PublicAnswerResult>;
  draft?: PublicExamDraft;
  exam?: {
    durationMinutes: number;
    passingCount: number;
    expiresAt: string;
  };
  examResult?: PublicExamResult;
};
