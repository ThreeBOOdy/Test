-- Issue #6: unified per-student per-level per-question learning state.
-- This is the persistence basis for FSRS scheduling, favorite/ignored marks,
-- and wrong/correct statistics. It is intentionally scoped to
-- (userId, levelId, questionId) so a student can have independent progress
-- in every letter-class question bank.

-- CreateTable
CREATE TABLE `StudentLevelQuestionState` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `state` ENUM('NEW', 'LEARNING', 'REVIEW', 'RELEARNING') NOT NULL DEFAULT 'NEW',
    `dueAt` DATETIME(3) NULL,
    `stability` DOUBLE NOT NULL DEFAULT 0,
    `difficulty` DOUBLE NOT NULL DEFAULT 5,
    `reps` INTEGER NOT NULL DEFAULT 0,
    `lapses` INTEGER NOT NULL DEFAULT 0,
    `intervalDays` INTEGER NOT NULL DEFAULT 0,
    `lastReviewedAt` DATETIME(3) NULL,
    `favorite` BOOLEAN NOT NULL DEFAULT false,
    `ignored` BOOLEAN NOT NULL DEFAULT false,
    `wrongCount` INTEGER NOT NULL DEFAULT 0,
    `correctCount` INTEGER NOT NULL DEFAULT 0,
    `lastResult` ENUM('CORRECT', 'INCORRECT') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudentLevelQuestionState_userId_levelId_questionId_key`(`userId`, `levelId`, `questionId`),
    INDEX `StudentLevelQuestionState_userId_levelId_state_dueAt_idx`(`userId`, `levelId`, `state`, `dueAt`),
    INDEX `StudentLevelQuestionState_userId_levelId_favorite_idx`(`userId`, `levelId`, `favorite`),
    INDEX `StudentLevelQuestionState_userId_levelId_ignored_idx`(`userId`, `levelId`, `ignored`),
    INDEX `StudentLevelQuestionState_questionId_idx`(`questionId`),
    INDEX `StudentLevelQuestionState_levelId_idx`(`levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `StudentLevelQuestionState` ADD CONSTRAINT `StudentLevelQuestionState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `StudentLevelQuestionState` ADD CONSTRAINT `StudentLevelQuestionState_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `StudentLevelQuestionState` ADD CONSTRAINT `StudentLevelQuestionState_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
