-- AlterTable: AI explanation fields on Question.
-- explanationStatus uses a plain String with a safe NONE default so existing rows
-- are compatible without a separate enum migration.
ALTER TABLE `Question` ADD COLUMN `explanation` TEXT NULL,
ADD COLUMN `explanationStatus` VARCHAR(191) NOT NULL DEFAULT 'NONE',
ADD COLUMN `explanationVersion` INTEGER NOT NULL DEFAULT 0,
ADD COLUMN `explanationReviewedById` VARCHAR(191) NULL,
ADD COLUMN `explanationReviewedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `AiUsageLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `promptTokens` INTEGER NOT NULL DEFAULT 0,
    `completionTokens` INTEGER NOT NULL DEFAULT 0,
    `totalTokens` INTEGER NOT NULL DEFAULT 0,
    `latencyMs` INTEGER NULL,
    `requestHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiUsageLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AiUsageLog_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_explanationReviewedById_fkey` FOREIGN KEY (`explanationReviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AiUsageLog` ADD CONSTRAINT `AiUsageLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
