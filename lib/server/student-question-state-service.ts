import "server-only";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/domain/api-error";
import { getStudentActiveLevelAccess, requireAssignedActiveLevel } from "@/lib/server/student-level-access";

export type StudentQuestionStateInput = {
  favorite?: boolean
  ignored?: boolean
};

export type StudentQuestionStateResponse = {
  questionId: string
  levelId: string
  levelCode: string
  favorite: boolean
  ignored: boolean
};

export async function setStudentQuestionState(
  userId: string,
  questionId: string,
  input: StudentQuestionStateInput,
): Promise<StudentQuestionStateResponse> {
  const { favorite, ignored } = input;
  if (favorite === undefined && ignored === undefined) {
    throw new ApiError("至少提供 favorite 或 ignored 字段", 400);
  }

  const access = await getStudentActiveLevelAccess(userId);
  const activeLevel = requireAssignedActiveLevel(access);

  const question = await prisma.question.findFirst({
    where: { id: questionId, levels: { some: { levelId: activeLevel.id } } },
    select: { id: true },
  });
  if (!question) {
    throw new ApiError("题目不存在或不属于当前字母类", 404);
  }

  const favoriteUpdate = favorite === undefined ? {} : { favorite };
  const ignoredUpdate = ignored === undefined ? {} : { ignored };
  const state = await prisma.studentLevelQuestionState.upsert({
    where: { userId_levelId_questionId: { userId, levelId: activeLevel.id, questionId } },
    update: { ...favoriteUpdate, ...ignoredUpdate },
    create: { userId, levelId: activeLevel.id, questionId, ...favoriteUpdate, ...ignoredUpdate },
    select: { favorite: true, ignored: true },
  });

  return {
    questionId,
    levelId: activeLevel.id,
    levelCode: activeLevel.code,
    favorite: state.favorite,
    ignored: state.ignored,
  };
}
