-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('STUDENT', 'TEACHER') NOT NULL DEFAULT 'STUDENT',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `sessionVersion` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Level` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Level_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ExamRule` (
    `id` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `singleCount` INTEGER NOT NULL,
    `multipleCount` INTEGER NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `passingCount` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExamRule_levelId_key`(`levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `KnowledgePoint` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `depth` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KnowledgePoint_code_key`(`code`),
    UNIQUE INDEX `KnowledgePoint_path_key`(`path`),
    INDEX `KnowledgePoint_parentId_sortOrder_idx`(`parentId`, `sortOrder`),
    INDEX `KnowledgePoint_path_idx`(`path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `LevelPracticeRule` (
    `id` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `singleCount` INTEGER NOT NULL DEFAULT 0,
    `multipleCount` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LevelPracticeRule_levelId_key`(`levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `KnowledgePracticeRule` (
    `id` VARCHAR(191) NOT NULL,
    `knowledgePointId` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `singleCount` INTEGER NOT NULL DEFAULT 0,
    `multipleCount` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgePracticeRule_levelId_idx`(`levelId`),
    UNIQUE INDEX `KnowledgePracticeRule_knowledgePointId_levelId_key`(`knowledgePointId`, `levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Question` (
    `id` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `knowledgePointId` VARCHAR(191) NOT NULL,
    `sourceBankCode` VARCHAR(191) NULL,
    `externalQuestionCode` VARCHAR(191) NULL,
    `stem` TEXT NOT NULL,
    `type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE') NOT NULL,
    `optionCount` INTEGER NOT NULL,
    `correctOptionCount` INTEGER NOT NULL,
    `selectionSpec` VARCHAR(191) NOT NULL,
    `options` JSON NOT NULL,
    `correctOptionIds` JSON NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `importBatchId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Question_levelId_type_status_idx`(`levelId`, `type`, `status`),
    INDEX `Question_knowledgePointId_levelId_type_status_idx`(`knowledgePointId`, `levelId`, `type`, `status`),
    INDEX `Question_externalQuestionCode_idx`(`externalQuestionCode`),
    UNIQUE INDEX `Question_levelId_externalQuestionCode_key`(`levelId`, `externalQuestionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PracticeSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `mode` ENUM('LEVEL_COMPREHENSIVE', 'KNOWLEDGE_POINT', 'WRONG_QUESTION', 'QUESTION_ORDER', 'RANDOM_ALL', 'MOCK_EXAM') NOT NULL,
    `levelId` VARCHAR(191) NULL,
    `knowledgePointId` VARCHAR(191) NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
    `singleCountSnapshot` INTEGER NOT NULL,
    `multipleCountSnapshot` INTEGER NOT NULL,
    `currentIndex` INTEGER NOT NULL DEFAULT 0,
    `correctCount` INTEGER NOT NULL DEFAULT 0,
    `durationMinutesSnapshot` INTEGER NULL,
    `passingCountSnapshot` INTEGER NULL,
    `expiresAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `PracticeSession_userId_status_startedAt_idx`(`userId`, `status`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PracticeSessionQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `snapshot` JSON NOT NULL,

    UNIQUE INDEX `PracticeSessionQuestion_sessionId_questionId_key`(`sessionId`, `questionId`),
    UNIQUE INDEX `PracticeSessionQuestion_sessionId_position_key`(`sessionId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PracticeAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `selectedOptionIds` JSON NOT NULL,
    `isCorrect` BOOLEAN NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PracticeAnswer_questionId_isCorrect_idx`(`questionId`, `isCorrect`),
    UNIQUE INDEX `PracticeAnswer_sessionId_questionId_key`(`sessionId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `WrongQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `wrongCount` INTEGER NOT NULL DEFAULT 1,
    `mastered` BOOLEAN NOT NULL DEFAULT false,
    `lastWrongAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `masteredAt` DATETIME(3) NULL,

    INDEX `WrongQuestion_userId_mastered_idx`(`userId`, `mastered`),
    UNIQUE INDEX `WrongQuestion_userId_questionId_key`(`userId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ImportBatch` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `status` ENUM('PREVIEW', 'COMMITTED', 'REVERTED', 'FAILED') NOT NULL DEFAULT 'PREVIEW',
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `validRows` INTEGER NOT NULL DEFAULT 0,
    `warningRows` INTEGER NOT NULL DEFAULT 0,
    `errorRows` INTEGER NOT NULL DEFAULT 0,
    `insertedRows` INTEGER NOT NULL DEFAULT 0,
    `duplicateRows` INTEGER NOT NULL DEFAULT 0,
    `errorReport` JSON NULL,
    `importedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `committedAt` DATETIME(3) NULL,
    `revertedAt` DATETIME(3) NULL,

    INDEX `ImportBatch_importedById_status_createdAt_idx`(`importedById`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ImportBatchRow` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `rowNumber` INTEGER NOT NULL,
    `payload` JSON NOT NULL,
    `issues` JSON NOT NULL,
    `valid` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ImportBatchRow_batchId_valid_rowNumber_idx`(`batchId`, `valid`, `rowNumber`),
    UNIQUE INDEX `ImportBatchRow_batchId_rowNumber_key`(`batchId`, `rowNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `LoginAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `usernameHash` VARCHAR(191) NOT NULL,
    `ipHash` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoginAttempt_usernameHash_success_createdAt_idx`(`usernameHash`, `success`, `createdAt`),
    INDEX `LoginAttempt_ipHash_success_createdAt_idx`(`ipHash`, `success`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `AuditLog_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `ExamRule` ADD CONSTRAINT `ExamRule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgePoint` ADD CONSTRAINT `KnowledgePoint_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `KnowledgePoint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LevelPracticeRule` ADD CONSTRAINT `LevelPracticeRule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgePracticeRule` ADD CONSTRAINT `KnowledgePracticeRule_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `KnowledgePoint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgePracticeRule` ADD CONSTRAINT `KnowledgePracticeRule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `KnowledgePoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `ImportBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeSession` ADD CONSTRAINT `PracticeSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeSession` ADD CONSTRAINT `PracticeSession_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeSession` ADD CONSTRAINT `PracticeSession_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `KnowledgePoint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeSessionQuestion` ADD CONSTRAINT `PracticeSessionQuestion_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PracticeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeSessionQuestion` ADD CONSTRAINT `PracticeSessionQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeAnswer` ADD CONSTRAINT `PracticeAnswer_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PracticeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeAnswer` ADD CONSTRAINT `PracticeAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportBatch` ADD CONSTRAINT `ImportBatch_importedById_fkey` FOREIGN KEY (`importedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportBatchRow` ADD CONSTRAINT `ImportBatchRow_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ImportBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
