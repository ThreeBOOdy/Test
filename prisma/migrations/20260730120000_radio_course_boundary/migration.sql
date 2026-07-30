-- CreateTable
CREATE TABLE `Course` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `activeSlot` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Course_code_key`(`code`),
    UNIQUE INDEX `Course_activeSlot_key`(`activeSlot`),
    INDEX `Course_enabled_sortOrder_idx`(`enabled`, `sortOrder`),
    CONSTRAINT `Course_radio_activation_check` CHECK (((`id` = 'course-radio' AND `code` = 'RADIO' AND `enabled` = true AND `activeSlot` IS NOT NULL AND `activeSlot` = 1) OR (`id` <> 'course-radio' AND `code` <> 'RADIO' AND `enabled` = false AND `activeSlot` IS NULL)) IS TRUE),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT INTO `Course` (`id`, `code`, `name`, `enabled`, `activeSlot`, `sortOrder`, `createdAt`, `updatedAt`)
VALUES ('course-radio', 'RADIO', '无线电课程', true, 1, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `enabled` = true, `activeSlot` = 1, `updatedAt` = CURRENT_TIMESTAMP(3);

CREATE TABLE `CourseBoundary` (
    `id` INTEGER NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `CourseBoundary_courseId_key`(`courseId`),
    CONSTRAINT `CourseBoundary_singleton_check` CHECK (`id` = 1 AND `courseId` = 'course-radio'),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT INTO `CourseBoundary` (`id`, `courseId`) VALUES (1, 'course-radio');
ALTER TABLE `CourseBoundary` ADD CONSTRAINT `CourseBoundary_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `Course` ADD COLUMN `boundaryId` INTEGER NULL;
UPDATE `Course` SET `boundaryId` = 1 WHERE `id` = 'course-radio';
ALTER TABLE `Course` ADD CONSTRAINT `Course_radio_boundary_check` CHECK (((`id` = 'course-radio' AND `boundaryId` = 1) OR (`id` <> 'course-radio' AND `boundaryId` IS NULL)) IS TRUE);
CREATE UNIQUE INDEX `Course_boundaryId_key` ON `Course`(`boundaryId`);
ALTER TABLE `Course` ADD CONSTRAINT `Course_boundaryId_fkey` FOREIGN KEY (`boundaryId`) REFERENCES `CourseBoundary`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `Level` ADD COLUMN `courseId` VARCHAR(191) NULL;
ALTER TABLE `KnowledgePoint` ADD COLUMN `courseId` VARCHAR(191) NULL;
ALTER TABLE `LevelPracticeRule` ADD COLUMN `courseId` VARCHAR(191) NULL;
ALTER TABLE `KnowledgePracticeRule` ADD COLUMN `courseId` VARCHAR(191) NULL;
ALTER TABLE `ExamRule` ADD COLUMN `courseId` VARCHAR(191) NULL;
ALTER TABLE `Question` ADD COLUMN `courseId` VARCHAR(191) NULL;
ALTER TABLE `ImportBatch` ADD COLUMN `courseId` VARCHAR(191) NULL;
ALTER TABLE `PracticeSession` ADD COLUMN `courseId` VARCHAR(191) NULL;
ALTER TABLE `PracticeSessionQuestion` ADD COLUMN `courseId` VARCHAR(191) NULL;
ALTER TABLE `PracticeAnswer` ADD COLUMN `courseId` VARCHAR(191) NULL;
ALTER TABLE `WrongQuestion` ADD COLUMN `courseId` VARCHAR(191) NULL;

UPDATE `Level` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;
UPDATE `KnowledgePoint` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;
UPDATE `LevelPracticeRule` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;
UPDATE `KnowledgePracticeRule` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;
UPDATE `ExamRule` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;
UPDATE `Question` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;
UPDATE `ImportBatch` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;
UPDATE `PracticeSession` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;
UPDATE `PracticeSessionQuestion` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;
UPDATE `PracticeAnswer` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;
UPDATE `WrongQuestion` SET `courseId` = 'course-radio' WHERE `courseId` IS NULL;

ALTER TABLE `Level` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';
ALTER TABLE `KnowledgePoint` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';
ALTER TABLE `LevelPracticeRule` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';
ALTER TABLE `KnowledgePracticeRule` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';
ALTER TABLE `ExamRule` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';
ALTER TABLE `Question` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';
ALTER TABLE `ImportBatch` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';
ALTER TABLE `PracticeSession` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';
ALTER TABLE `PracticeSessionQuestion` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';
ALTER TABLE `PracticeAnswer` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';
ALTER TABLE `WrongQuestion` MODIFY `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio';

ALTER TABLE `ExamRule` DROP FOREIGN KEY `ExamRule_levelId_fkey`;
ALTER TABLE `KnowledgePoint` DROP FOREIGN KEY `KnowledgePoint_parentId_fkey`;
ALTER TABLE `LevelPracticeRule` DROP FOREIGN KEY `LevelPracticeRule_levelId_fkey`;
ALTER TABLE `KnowledgePracticeRule` DROP FOREIGN KEY `KnowledgePracticeRule_knowledgePointId_fkey`;
ALTER TABLE `KnowledgePracticeRule` DROP FOREIGN KEY `KnowledgePracticeRule_levelId_fkey`;
ALTER TABLE `Question` DROP FOREIGN KEY `Question_levelId_fkey`;
ALTER TABLE `Question` DROP FOREIGN KEY `Question_knowledgePointId_fkey`;
ALTER TABLE `Question` DROP FOREIGN KEY `Question_importBatchId_fkey`;
ALTER TABLE `PracticeSession` DROP FOREIGN KEY `PracticeSession_levelId_fkey`;
ALTER TABLE `PracticeSession` DROP FOREIGN KEY `PracticeSession_knowledgePointId_fkey`;
ALTER TABLE `PracticeSessionQuestion` DROP FOREIGN KEY `PracticeSessionQuestion_sessionId_fkey`;
ALTER TABLE `PracticeSessionQuestion` DROP FOREIGN KEY `PracticeSessionQuestion_questionId_fkey`;
ALTER TABLE `PracticeAnswer` DROP FOREIGN KEY `PracticeAnswer_sessionId_fkey`;
ALTER TABLE `PracticeAnswer` DROP FOREIGN KEY `PracticeAnswer_questionId_fkey`;
ALTER TABLE `WrongQuestion` DROP FOREIGN KEY `WrongQuestion_questionId_fkey`;

DROP INDEX `Level_code_key` ON `Level`;
DROP INDEX `KnowledgePoint_code_key` ON `KnowledgePoint`;
DROP INDEX `KnowledgePoint_path_key` ON `KnowledgePoint`;
DROP INDEX `KnowledgePoint_parentId_sortOrder_idx` ON `KnowledgePoint`;
DROP INDEX `KnowledgePoint_path_idx` ON `KnowledgePoint`;
DROP INDEX `Question_levelId_externalQuestionCode_key` ON `Question`;
DROP INDEX `Question_levelId_type_status_idx` ON `Question`;
DROP INDEX `Question_knowledgePointId_levelId_type_status_idx` ON `Question`;
DROP INDEX `Question_externalQuestionCode_idx` ON `Question`;
DROP INDEX `KnowledgePracticeRule_knowledgePointId_levelId_key` ON `KnowledgePracticeRule`;
DROP INDEX `KnowledgePracticeRule_levelId_idx` ON `KnowledgePracticeRule`;
DROP INDEX `ExamRule_levelId_key` ON `ExamRule`;
DROP INDEX `LevelPracticeRule_levelId_key` ON `LevelPracticeRule`;
DROP INDEX `PracticeSessionQuestion_sessionId_questionId_key` ON `PracticeSessionQuestion`;
DROP INDEX `PracticeSessionQuestion_sessionId_position_key` ON `PracticeSessionQuestion`;
DROP INDEX `PracticeAnswer_sessionId_questionId_key` ON `PracticeAnswer`;
DROP INDEX `WrongQuestion_userId_questionId_key` ON `WrongQuestion`;
DROP INDEX `PracticeAnswer_questionId_isCorrect_idx` ON `PracticeAnswer`;

CREATE UNIQUE INDEX `Level_courseId_code_key` ON `Level`(`courseId`, `code`);
CREATE UNIQUE INDEX `Level_courseId_id_key` ON `Level`(`courseId`, `id`);
CREATE INDEX `Level_courseId_enabled_sortOrder_idx` ON `Level`(`courseId`, `enabled`, `sortOrder`);
CREATE UNIQUE INDEX `KnowledgePoint_courseId_code_key` ON `KnowledgePoint`(`courseId`, `code`);
CREATE UNIQUE INDEX `KnowledgePoint_courseId_path_key` ON `KnowledgePoint`(`courseId`, `path`);
CREATE UNIQUE INDEX `KnowledgePoint_courseId_id_key` ON `KnowledgePoint`(`courseId`, `id`);
CREATE INDEX `KnowledgePoint_courseId_parentId_sortOrder_idx` ON `KnowledgePoint`(`courseId`, `parentId`, `sortOrder`);
CREATE UNIQUE INDEX `ExamRule_courseId_levelId_key` ON `ExamRule`(`courseId`, `levelId`);
CREATE UNIQUE INDEX `LevelPracticeRule_courseId_levelId_key` ON `LevelPracticeRule`(`courseId`, `levelId`);
CREATE UNIQUE INDEX `KnowledgePracticeRule_courseId_knowledgePointId_levelId_key` ON `KnowledgePracticeRule`(`courseId`, `knowledgePointId`, `levelId`);
CREATE INDEX `KnowledgePracticeRule_courseId_levelId_idx` ON `KnowledgePracticeRule`(`courseId`, `levelId`);
CREATE UNIQUE INDEX `Question_courseId_levelId_externalQuestionCode_key` ON `Question`(`courseId`, `levelId`, `externalQuestionCode`);
CREATE UNIQUE INDEX `Question_courseId_id_key` ON `Question`(`courseId`, `id`);
CREATE INDEX `Question_courseId_levelId_type_status_idx` ON `Question`(`courseId`, `levelId`, `type`, `status`);
CREATE INDEX `Question_courseId_knowledgePointId_levelId_type_status_idx` ON `Question`(`courseId`, `knowledgePointId`, `levelId`, `type`, `status`);
CREATE INDEX `Question_courseId_externalQuestionCode_idx` ON `Question`(`courseId`, `externalQuestionCode`);
CREATE UNIQUE INDEX `ImportBatch_courseId_id_key` ON `ImportBatch`(`courseId`, `id`);
CREATE UNIQUE INDEX `PracticeSession_courseId_id_key` ON `PracticeSession`(`courseId`, `id`);
CREATE UNIQUE INDEX `PracticeSessionQuestion_courseId_sessionId_questionId_key` ON `PracticeSessionQuestion`(`courseId`, `sessionId`, `questionId`);
CREATE UNIQUE INDEX `PracticeSessionQuestion_courseId_sessionId_position_key` ON `PracticeSessionQuestion`(`courseId`, `sessionId`, `position`);
CREATE UNIQUE INDEX `PracticeAnswer_courseId_sessionId_questionId_key` ON `PracticeAnswer`(`courseId`, `sessionId`, `questionId`);
CREATE INDEX `PracticeAnswer_courseId_questionId_isCorrect_idx` ON `PracticeAnswer`(`courseId`, `questionId`, `isCorrect`);
CREATE UNIQUE INDEX `WrongQuestion_courseId_userId_questionId_key` ON `WrongQuestion`(`courseId`, `userId`, `questionId`);
CREATE INDEX `WrongQuestion_courseId_userId_mastered_idx` ON `WrongQuestion`(`courseId`, `userId`, `mastered`);

ALTER TABLE `Level` ADD CONSTRAINT `Level_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `KnowledgePoint` ADD CONSTRAINT `KnowledgePoint_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LevelPracticeRule` ADD CONSTRAINT `LevelPracticeRule_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `KnowledgePracticeRule` ADD CONSTRAINT `KnowledgePracticeRule_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ExamRule` ADD CONSTRAINT `ExamRule_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Question` ADD CONSTRAINT `Question_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ImportBatch` ADD CONSTRAINT `ImportBatch_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PracticeSession` ADD CONSTRAINT `PracticeSession_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PracticeSessionQuestion` ADD CONSTRAINT `PracticeSessionQuestion_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PracticeAnswer` ADD CONSTRAINT `PracticeAnswer_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ExamRule` ADD CONSTRAINT `ExamRule_courseId_levelId_fkey` FOREIGN KEY (`courseId`, `levelId`) REFERENCES `Level`(`courseId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KnowledgePoint` ADD CONSTRAINT `KnowledgePoint_courseId_parentId_fkey` FOREIGN KEY (`courseId`, `parentId`) REFERENCES `KnowledgePoint`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LevelPracticeRule` ADD CONSTRAINT `LevelPracticeRule_courseId_levelId_fkey` FOREIGN KEY (`courseId`, `levelId`) REFERENCES `Level`(`courseId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KnowledgePracticeRule` ADD CONSTRAINT `KnowledgePracticeRule_courseId_knowledgePointId_fkey` FOREIGN KEY (`courseId`, `knowledgePointId`) REFERENCES `KnowledgePoint`(`courseId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KnowledgePracticeRule` ADD CONSTRAINT `KnowledgePracticeRule_courseId_levelId_fkey` FOREIGN KEY (`courseId`, `levelId`) REFERENCES `Level`(`courseId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Question` ADD CONSTRAINT `Question_courseId_levelId_fkey` FOREIGN KEY (`courseId`, `levelId`) REFERENCES `Level`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Question` ADD CONSTRAINT `Question_courseId_knowledgePointId_fkey` FOREIGN KEY (`courseId`, `knowledgePointId`) REFERENCES `KnowledgePoint`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Question` ADD CONSTRAINT `Question_courseId_importBatchId_fkey` FOREIGN KEY (`courseId`, `importBatchId`) REFERENCES `ImportBatch`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PracticeSession` ADD CONSTRAINT `PracticeSession_courseId_levelId_fkey` FOREIGN KEY (`courseId`, `levelId`) REFERENCES `Level`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PracticeSession` ADD CONSTRAINT `PracticeSession_courseId_knowledgePointId_fkey` FOREIGN KEY (`courseId`, `knowledgePointId`) REFERENCES `KnowledgePoint`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PracticeSessionQuestion` ADD CONSTRAINT `PracticeSessionQuestion_courseId_sessionId_fkey` FOREIGN KEY (`courseId`, `sessionId`) REFERENCES `PracticeSession`(`courseId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PracticeSessionQuestion` ADD CONSTRAINT `PracticeSessionQuestion_courseId_questionId_fkey` FOREIGN KEY (`courseId`, `questionId`) REFERENCES `Question`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PracticeAnswer` ADD CONSTRAINT `PracticeAnswer_courseId_sessionId_fkey` FOREIGN KEY (`courseId`, `sessionId`) REFERENCES `PracticeSession`(`courseId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PracticeAnswer` ADD CONSTRAINT `PracticeAnswer_courseId_questionId_fkey` FOREIGN KEY (`courseId`, `questionId`) REFERENCES `Question`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_courseId_questionId_fkey` FOREIGN KEY (`courseId`, `questionId`) REFERENCES `Question`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
