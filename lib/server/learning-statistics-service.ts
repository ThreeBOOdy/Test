import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type Numeric = number | bigint | string;

export type LearningStatistics = {
  summary: { completedSessions: number; activeStudents: number; answered: number; correct: number; accuracy: number };
  knowledgePoints: { code: string; name: string; answered: number; correct: number; accuracy: number }[];
  students: { displayName: string; completedSessions: number; answered: number; correct: number; accuracy: number }[];
};

type KnowledgePointRow = { code: string; name: string; answered: Numeric; correct: Numeric };
type StudentRow = { displayName: string; completedSessions: Numeric; answered: Numeric; correct: Numeric };

const completedSessionWhere = (since?: Date) => ({
  status: "COMPLETED" as const,
  user: { role: "STUDENT" as const },
  ...(since ? { completedAt: { gte: since } } : {}),
});

export async function getStudentLearningSummary(userId: string) {
  const where = { ...completedSessionWhere(), userId };
  const [completedSessions, answered, correct, duration] = await Promise.all([
    prisma.practiceSession.count({ where }),
    prisma.practiceAnswer.count({ where: { session: where } }),
    prisma.practiceAnswer.count({ where: { isCorrect: true, session: where } }),
    prisma.$queryRaw<Array<{ minutes: Numeric }>>(Prisma.sql`SELECT CAST(COALESCE(SUM(TIMESTAMPDIFF(SECOND, \`startedAt\`, \`completedAt\`)), 0) AS SIGNED) / 60 AS minutes FROM \`PracticeSession\` WHERE \`userId\` = ${userId} AND \`status\` = 'COMPLETED'`),
  ]);
  return { completedSessions, answered, correct, accuracy: ratio(correct, answered), totalMinutes: Math.round(Number(duration[0]?.minutes ?? 0)) };
}

export async function getTeacherLearningStatistics(since: Date): Promise<LearningStatistics> {
  const completedWhere = completedSessionWhere(since);
  const [completedSessions, answered, correct, activeRows, knowledgeRows, studentRows] = await Promise.all([
    prisma.practiceSession.count({ where: completedWhere }),
    prisma.practiceAnswer.count({ where: { session: completedWhere } }),
    prisma.practiceAnswer.count({ where: { isCorrect: true, session: completedWhere } }),
    prisma.$queryRaw<Array<{ count: Numeric }>>(Prisma.sql`SELECT CAST(COUNT(DISTINCT ps.\`userId\`) AS SIGNED) AS count FROM \`PracticeSession\` ps JOIN \`User\` u ON u.id = ps.\`userId\` WHERE ps.\`startedAt\` >= ${since} AND u.\`role\` = 'STUDENT'`),
    prisma.$queryRaw<KnowledgePointRow[]>(Prisma.sql`SELECT kp.code, kp.name, CAST(COUNT(pa.id) AS SIGNED) AS answered, CAST(SUM(CASE WHEN pa.\`isCorrect\` = TRUE THEN 1 ELSE 0 END) AS SIGNED) AS correct FROM \`PracticeAnswer\` pa JOIN \`PracticeSession\` ps ON ps.id = pa.\`sessionId\` JOIN \`Question\` q ON q.id = pa.\`questionId\` JOIN \`KnowledgePoint\` kp ON kp.id = q.\`knowledgePointId\` WHERE ps.\`status\` = 'COMPLETED' AND ps.\`completedAt\` >= ${since} GROUP BY kp.id, kp.code, kp.name ORDER BY (COUNT(pa.id) - SUM(CASE WHEN pa.\`isCorrect\` = TRUE THEN 1 ELSE 0 END)) DESC, COUNT(pa.id) DESC LIMIT 10`),
    prisma.$queryRaw<StudentRow[]>(Prisma.sql`SELECT u.\`displayName\`, CAST(COUNT(DISTINCT ps.id) AS SIGNED) AS completedSessions, CAST(COUNT(pa.id) AS SIGNED) AS answered, CAST(SUM(CASE WHEN pa.\`isCorrect\` = TRUE THEN 1 ELSE 0 END) AS SIGNED) AS correct FROM \`User\` u JOIN \`PracticeSession\` ps ON ps.\`userId\` = u.id AND ps.\`status\` = 'COMPLETED' AND ps.\`completedAt\` >= ${since} LEFT JOIN \`PracticeAnswer\` pa ON pa.\`sessionId\` = ps.id WHERE u.role = 'STUDENT' GROUP BY u.id, u.\`displayName\` ORDER BY COUNT(pa.id) DESC, u.\`displayName\` ASC LIMIT 20`),
  ]);
  return {
    summary: { completedSessions, activeStudents: Number(activeRows[0]?.count ?? 0), answered, correct, accuracy: ratio(correct, answered) },
    knowledgePoints: knowledgeRows.map((row) => ({ code: row.code, name: row.name, answered: Number(row.answered), correct: Number(row.correct), accuracy: ratio(Number(row.correct), Number(row.answered)) })),
    students: studentRows.map((row) => ({ displayName: row.displayName, completedSessions: Number(row.completedSessions), answered: Number(row.answered), correct: Number(row.correct), accuracy: ratio(Number(row.correct), Number(row.answered)) })),
  };
}

function ratio(correct: number, answered: number) {
  return answered ? Math.round(correct / answered * 100) : 0;
}
