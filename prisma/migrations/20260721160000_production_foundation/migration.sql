-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PracticeSession" ALTER COLUMN "levelId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PracticeSessionQuestion" ADD COLUMN "snapshot" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "ImportBatch"
ADD COLUMN "insertedRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "duplicateRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ImportBatchRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatchRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "usernameHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Question_levelId_externalQuestionCode_key" ON "Question"("levelId", "externalQuestionCode");
CREATE UNIQUE INDEX "ImportBatchRow_batchId_rowNumber_key" ON "ImportBatchRow"("batchId", "rowNumber");
CREATE INDEX "ImportBatchRow_batchId_valid_rowNumber_idx" ON "ImportBatchRow"("batchId", "valid", "rowNumber");
CREATE INDEX "ImportBatch_importedById_status_createdAt_idx" ON "ImportBatch"("importedById", "status", "createdAt");
CREATE INDEX "LoginAttempt_usernameHash_success_createdAt_idx" ON "LoginAttempt"("usernameHash", "success", "createdAt");
CREATE INDEX "LoginAttempt_ipHash_success_createdAt_idx" ON "LoginAttempt"("ipHash", "success", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "ImportBatchRow" ADD CONSTRAINT "ImportBatchRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
