import type { DocxImage } from "./docx-content";
import type { StudentExplanation } from "./student-explanation";

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
  levelIds: string[];
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
  explanation?: string | null;
  explanationStatus?: "NONE" | "DRAFT" | "APPROVED" | "REJECTED" | (string & {});
  explanationVersion?: number;
  explanationReviewedById?: string | null;
  explanationReviewedAt?: Date | string | null;
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

export type ExamBlueprint = {
  id: string;
  levelId: string;
  name: string;
  /** 空表示不限时。 */
  durationMinutes: number | null;
  passingCount: number;
  enabled: boolean;
  isDefault: boolean;
};

export type ExamBlueprintItem = {
  id: string;
  blueprintId: string;
  knowledgePointId: string;
  singleCount: number;
  multipleCount: number;
};

export type ExamBlueprintInput = Omit<ExamBlueprint, "id">;
export type ExamBlueprintItemInput = Omit<ExamBlueprintItem, "id">;

export type ExamBlueprintItemWeight = {
  knowledgePointId: string;
  singleWeight: number;
  multipleWeight: number;
};

export type ExamBlueprintAllocation = {
  knowledgePointId: string;
  singleCount: number;
  multipleCount: number;
};

export type ImportQuestionRow = {
  rowNumber: number;
  locationLabel?: string;
  sheetName?: string;
  sourceBankCode?: string;
  categoryCode: string;
  knowledgePointName?: string;
  /** 单 sheet/Word 向导选择或新建的知识点类型；多 sheet 导入由 sheetName 自动决定。 */
  knowledgePointTypeId?: string;
  knowledgePointTypeCode?: string;
  knowledgePointTypeName?: string;
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
export type PublicQuestion = Omit<Question, "levelIds" | "correctOptionIds" | "status" | "correctOptionCount" | "selectionSpec" | "explanation"> & {
  levelId: string;
  knowledgeName: string;
  levelCode: string;
  /** 当前学生在该字母类下的收藏/忽略标记；练习会话中用于展示与即时更新。 */
  favorite?: boolean;
  ignored?: boolean;
};

export type PublicAnswerResult = {
  isCorrect: boolean;
  correctOptionIds: string[];
  selectedOptionIds: string[];
  answeredCount: number;
  correctCount: number;
  /** 仅当题目存在 APPROVED 解析时由服务端注入；DRAFT/REJECTED 不会出现在学生端。 */
  explanation?: StudentExplanation | null;
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

export type FocusSessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export type PublicFocusSession = {
  id: string;
  status: FocusSessionStatus;
  targetMinutes: number | null;
  targetQuestionCount: number | null;
  actualMinutes: number | null;
  actualQuestionCount: number | null;
  startedAt: string;
  endedAt: string | null;
};

export type FocusOverview = {
  currentStreak: number;
  todayCheckedIn: boolean;
  todayFocusMinutes: number;
  activeFocusSession: PublicFocusSession | null;
};

export type PublicPracticeSession = {
  id: string;
  mode: PracticeMode;
  /** 顺序刷题模式：true = 学习模式（不写学习状态），false = 练习模式（默认）。 */
  learningMode: boolean;
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
  /** 随机刷题阶段性完成：全部题目已满足 reps>0、无到期、intervalDays>=7。 */
  stageCompleted?: boolean;
  /** 顺序刷题跨会话进度：lastIndex 表示当前轮已完成题数，roundCount 表示已完整刷完的轮次。 */
  sequentialProgress?: {
    lastIndex: number;
    roundCount: number;
  };
};
