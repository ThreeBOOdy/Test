-- AlterTable
ALTER TABLE `PracticeAnswer` ADD COLUMN `idempotencyKey` VARCHAR(128) NULL;
ALTER TABLE `PracticeAnswer` ADD COLUMN `answeredCountAtSubmission` INTEGER NULL;
ALTER TABLE `PracticeAnswer` ADD COLUMN `correctCountAtSubmission` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `PracticeAnswer_courseId_sessionId_idempotencyKey_key` ON `PracticeAnswer`(`courseId`, `sessionId`, `idempotencyKey`);
