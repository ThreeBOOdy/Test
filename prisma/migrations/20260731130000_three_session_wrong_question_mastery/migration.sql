-- AlterTable
ALTER TABLE `WrongQuestion` ADD COLUMN `lastWrongReason` VARCHAR(191) NULL;
ALTER TABLE `WrongQuestion` ADD COLUMN `correctSessionCount` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `WrongQuestion` ADD COLUMN `lastCountedSessionId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `WrongQuestion_userId_mastered_correctSessionCount_idx` ON `WrongQuestion`(`userId`, `mastered`, `correctSessionCount`);
