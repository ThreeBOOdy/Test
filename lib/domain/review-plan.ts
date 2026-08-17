export type ReviewPlanType = "DAILY" | "EXAM_SPRINT";
export type ReviewPlanStatus = "ACTIVE" | "COMPLETED";
export type ReviewCardSource = "WRONG_QUESTION" | "WEAK_KNOWLEDGE";
export type ReviewCardStatus = "PENDING" | "COMPLETED";

export type PublicReviewCard = {
  id: string;
  questionId: string;
  knowledgePointId: string | null;
  knowledgeName: string;
  levelCode: string;
  stem: string;
  source: ReviewCardSource;
  priority: number;
  status: ReviewCardStatus;
  completedAt: string | null;
  launchHref: string;
};

export type PublicReviewPlan = {
  id: string;
  planDate: string;
  type: ReviewPlanType;
  status: ReviewPlanStatus;
  examDate: string | null;
  completedAt: string | null;
  total: number;
  completed: number;
  cards: PublicReviewCard[];
};
