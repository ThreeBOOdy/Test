ALTER TYPE "PracticeMode" ADD VALUE 'QUESTION_ORDER';
ALTER TYPE "PracticeMode" ADD VALUE 'RANDOM_ALL';
ALTER TYPE "PracticeMode" ADD VALUE 'MOCK_EXAM';

ALTER TABLE "PracticeSession"
ADD COLUMN "durationMinutesSnapshot" INTEGER,
ADD COLUMN "passingCountSnapshot" INTEGER,
ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE TABLE "ExamRule" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "singleCount" INTEGER NOT NULL,
    "multipleCount" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "passingCount" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExamRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamRule_levelId_key" ON "ExamRule"("levelId");
ALTER TABLE "ExamRule" ADD CONSTRAINT "ExamRule_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ExamRule" ("id", "levelId", "singleCount", "multipleCount", "durationMinutes", "passingCount", "enabled", "updatedAt")
SELECT 'exam-rule-' || "code", "id",
  CASE "code" WHEN 'A' THEN 32 WHEN 'B' THEN 45 WHEN 'C' THEN 70 END,
  CASE "code" WHEN 'A' THEN 8 WHEN 'B' THEN 15 WHEN 'C' THEN 20 END,
  CASE "code" WHEN 'A' THEN 40 WHEN 'B' THEN 60 WHEN 'C' THEN 90 END,
  CASE "code" WHEN 'A' THEN 30 WHEN 'B' THEN 45 WHEN 'C' THEN 70 END,
  true,
  CURRENT_TIMESTAMP
FROM "Level"
WHERE "code" IN ('A', 'B', 'C')
ON CONFLICT ("levelId") DO NOTHING;
