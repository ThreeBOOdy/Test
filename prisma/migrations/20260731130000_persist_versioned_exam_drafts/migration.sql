CREATE TABLE `ExamDraft` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio',
    `sessionId` VARCHAR(191) NOT NULL,
    `answers` JSON NOT NULL,
    `currentIndex` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `ExamDraft_courseId_sessionId_key` (`courseId`, `sessionId`),
    INDEX `ExamDraft_updatedAt_idx` (`updatedAt`),
    CONSTRAINT `ExamDraft_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `ExamDraft_courseId_sessionId_fkey` FOREIGN KEY (`courseId`, `sessionId`) REFERENCES `PracticeSession` (`courseId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
