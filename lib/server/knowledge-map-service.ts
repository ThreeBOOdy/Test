import "server-only";
import { prisma } from "@/lib/db";
import { buildPracticeLaunchHref } from "@/lib/domain/practice-launcher";
import { getKnowledgeRuleInventory, isPracticeRuleWithinInventory } from "@/lib/domain/knowledge-rules";
import { decorateKnowledgeMap, type KnowledgeMapStats, type PublicKnowledgeMap } from "@/lib/domain/knowledge-map";

export async function getStudentKnowledgeMap(userId: string): Promise<PublicKnowledgeMap> {
  const [points, answers, wrongQuestions, rules, questions, profile] = await Promise.all([
    prisma.knowledgePoint.findMany({
      where: { enabled: true },
      orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    }),
    prisma.practiceAnswer.findMany({
      where: { session: { userId, status: "COMPLETED" } },
      select: { isCorrect: true, question: { select: { knowledgePointId: true } } },
    }),
    prisma.wrongQuestion.findMany({
      where: { userId, mastered: false, question: { status: "ACTIVE", knowledgePoint: { enabled: true } } },
      select: { question: { select: { knowledgePointId: true } } },
    }),
    prisma.knowledgePracticeRule.findMany({
      where: { enabled: true, level: { enabled: true }, knowledgePoint: { enabled: true } },
      include: {
        level: { select: { code: true } },
        knowledgePoint: { select: { id: true, depth: true } },
      },
      orderBy: [{ level: { sortOrder: "asc" } }, { level: { code: "asc" } }],
    }),
    prisma.question.findMany({
      where: { status: "ACTIVE", knowledgePoint: { enabled: true } },
      select: { levelId: true, knowledgePointId: true, type: true },
    }),
    prisma.playerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }),
  ]);

  const statsById = new Map<string, KnowledgeMapStats>();
  for (const answer of answers) {
    const pointId = answer.question.knowledgePointId;
    const current = statsById.get(pointId) ?? { answered: 0, correct: 0, hasUnmasteredWrong: false };
    current.answered += 1;
    if (answer.isCorrect) current.correct += 1;
    statsById.set(pointId, current);
  }
  for (const wrong of wrongQuestions) {
    const pointId = wrong.question.knowledgePointId;
    const current = statsById.get(pointId) ?? { answered: 0, correct: 0, hasUnmasteredWrong: false };
    current.hasUnmasteredWrong = true;
    statsById.set(pointId, current);
  }

  const pointById = new Map(points.map((point) => [point.id, point]));
  const practiceHrefs = new Map<string, string>();
  const inventoryQuestions = questions.map((question) => ({ ...question, status: "ACTIVE" as const }));
  for (const rule of rules) {
    const point = pointById.get(rule.knowledgePointId);
    if (!point || point.depth !== 2) continue;
    const inventory = getKnowledgeRuleInventory(inventoryQuestions, rule.levelId, rule.knowledgePointId);
    if (!isPracticeRuleWithinInventory(rule, inventory)) continue;
    if (!practiceHrefs.has(point.id)) {
      practiceHrefs.set(
        point.id,
        buildPracticeLaunchHref({
          mode: "KNOWLEDGE_POINT",
          levelCode: rule.level.code,
          knowledgePointId: point.id,
        }),
      );
    }
  }

  return decorateKnowledgeMap(points, statsById, practiceHrefs, profile.mapEnabled);
}
