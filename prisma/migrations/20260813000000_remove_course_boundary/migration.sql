-- Remove the single-course boundary: drop the Course table and every courseId
-- column in place. Data in all other columns is preserved.
-- Phase order matters: child foreign keys must be dropped before the parent
-- indexes they rely on, so we drop all foreign keys first, then indexes,
-- then columns, then the Course table, and finally recreate the new shape.
-- Table identifiers must match the PascalCase names created by earlier
-- migrations: MySQL on Linux is case-sensitive for table names.

-- Phase 1: drop every foreign key that involves courseId
ALTER TABLE `ExamDraft` DROP FOREIGN KEY `ExamDraft_courseId_fkey`;
ALTER TABLE `ExamDraft` DROP FOREIGN KEY `ExamDraft_courseId_sessionId_fkey`;
ALTER TABLE `ExamRule` DROP FOREIGN KEY `ExamRule_courseId_fkey`;
ALTER TABLE `ExamRule` DROP FOREIGN KEY `ExamRule_courseId_levelId_fkey`;
ALTER TABLE `ImportBatch` DROP FOREIGN KEY `ImportBatch_courseId_fkey`;
ALTER TABLE `KnowledgePoint` DROP FOREIGN KEY `KnowledgePoint_courseId_fkey`;
ALTER TABLE `KnowledgePoint` DROP FOREIGN KEY `KnowledgePoint_courseId_parentId_fkey`;
ALTER TABLE `KnowledgePracticeRule` DROP FOREIGN KEY `KnowledgePracticeRule_courseId_fkey`;
ALTER TABLE `KnowledgePracticeRule` DROP FOREIGN KEY `KnowledgePracticeRule_courseId_knowledgePointId_fkey`;
ALTER TABLE `KnowledgePracticeRule` DROP FOREIGN KEY `KnowledgePracticeRule_courseId_levelId_fkey`;
ALTER TABLE `Level` DROP FOREIGN KEY `Level_courseId_fkey`;
ALTER TABLE `LevelPracticeRule` DROP FOREIGN KEY `LevelPracticeRule_courseId_fkey`;
ALTER TABLE `LevelPracticeRule` DROP FOREIGN KEY `LevelPracticeRule_courseId_levelId_fkey`;
ALTER TABLE `PracticeAnswer` DROP FOREIGN KEY `PracticeAnswer_courseId_fkey`;
ALTER TABLE `PracticeAnswer` DROP FOREIGN KEY `PracticeAnswer_courseId_questionId_fkey`;
ALTER TABLE `PracticeAnswer` DROP FOREIGN KEY `PracticeAnswer_courseId_sessionId_fkey`;
ALTER TABLE `PracticeSession` DROP FOREIGN KEY `PracticeSession_courseId_fkey`;
ALTER TABLE `PracticeSession` DROP FOREIGN KEY `PracticeSession_courseId_knowledgePointId_fkey`;
ALTER TABLE `PracticeSession` DROP FOREIGN KEY `PracticeSession_courseId_levelId_fkey`;
ALTER TABLE `PracticeSessionQuestion` DROP FOREIGN KEY `PracticeSessionQuestion_courseId_fkey`;
ALTER TABLE `PracticeSessionQuestion` DROP FOREIGN KEY `PracticeSessionQuestion_courseId_questionId_fkey`;
ALTER TABLE `PracticeSessionQuestion` DROP FOREIGN KEY `PracticeSessionQuestion_courseId_sessionId_fkey`;
ALTER TABLE `Question` DROP FOREIGN KEY `Question_courseId_fkey`;
ALTER TABLE `Question` DROP FOREIGN KEY `Question_courseId_importBatchId_fkey`;
ALTER TABLE `Question` DROP FOREIGN KEY `Question_courseId_knowledgePointId_fkey`;
ALTER TABLE `Question` DROP FOREIGN KEY `Question_courseId_levelId_fkey`;
ALTER TABLE `QuestionImage` DROP FOREIGN KEY `QuestionImage_courseId_fkey`;
ALTER TABLE `QuestionImage` DROP FOREIGN KEY `QuestionImage_courseId_questionId_fkey`;
ALTER TABLE `QuestionRevision` DROP FOREIGN KEY `QuestionRevision_courseId_questionId_fkey`;
ALTER TABLE `WrongQuestion` DROP FOREIGN KEY `WrongQuestion_courseId_fkey`;
ALTER TABLE `WrongQuestion` DROP FOREIGN KEY `WrongQuestion_courseId_questionId_fkey`;

-- Phase 2: drop every index that contains courseId
ALTER TABLE `ExamDraft` DROP INDEX `ExamDraft_courseId_sessionId_key`;
ALTER TABLE `ExamRule` DROP INDEX `ExamRule_courseId_levelId_key`;
ALTER TABLE `ImportBatch` DROP INDEX `ImportBatch_courseId_id_key`;
ALTER TABLE `KnowledgePoint` DROP INDEX `KnowledgePoint_courseId_code_key`;
ALTER TABLE `KnowledgePoint` DROP INDEX `KnowledgePoint_courseId_id_key`;
ALTER TABLE `KnowledgePoint` DROP INDEX `KnowledgePoint_courseId_parentId_sortOrder_idx`;
ALTER TABLE `KnowledgePoint` DROP INDEX `KnowledgePoint_courseId_path_key`;
ALTER TABLE `KnowledgePracticeRule` DROP INDEX `KnowledgePracticeRule_courseId_knowledgePointId_levelId_key`;
ALTER TABLE `KnowledgePracticeRule` DROP INDEX `KnowledgePracticeRule_courseId_levelId_idx`;
ALTER TABLE `Level` DROP INDEX `Level_courseId_code_key`;
ALTER TABLE `Level` DROP INDEX `Level_courseId_enabled_sortOrder_idx`;
ALTER TABLE `Level` DROP INDEX `Level_courseId_id_key`;
ALTER TABLE `LevelPracticeRule` DROP INDEX `LevelPracticeRule_courseId_levelId_key`;
ALTER TABLE `PracticeAnswer` DROP INDEX `PracticeAnswer_courseId_questionId_isCorrect_idx`;
ALTER TABLE `PracticeAnswer` DROP INDEX `PracticeAnswer_courseId_sessionId_idempotencyKey_key`;
ALTER TABLE `PracticeAnswer` DROP INDEX `PracticeAnswer_courseId_sessionId_questionId_key`;
ALTER TABLE `PracticeSession` DROP INDEX `PracticeSession_courseId_id_key`;
ALTER TABLE `PracticeSession` DROP INDEX `PracticeSession_courseId_knowledgePointId_fkey`;
ALTER TABLE `PracticeSession` DROP INDEX `PracticeSession_courseId_levelId_fkey`;
ALTER TABLE `PracticeSessionQuestion` DROP INDEX `PracticeSessionQuestion_courseId_questionId_fkey`;
ALTER TABLE `PracticeSessionQuestion` DROP INDEX `PracticeSessionQuestion_courseId_sessionId_position_key`;
ALTER TABLE `PracticeSessionQuestion` DROP INDEX `PracticeSessionQuestion_courseId_sessionId_questionId_key`;
ALTER TABLE `Question` DROP INDEX `Question_courseId_externalQuestionCode_idx`;
ALTER TABLE `Question` DROP INDEX `Question_courseId_id_key`;
ALTER TABLE `Question` DROP INDEX `Question_courseId_importBatchId_fkey`;
ALTER TABLE `Question` DROP INDEX `Question_courseId_knowledgePointId_levelId_type_status_idx`;
ALTER TABLE `Question` DROP INDEX `Question_courseId_levelId_externalQuestionCode_key`;
ALTER TABLE `Question` DROP INDEX `Question_courseId_levelId_type_status_idx`;
ALTER TABLE `QuestionImage` DROP INDEX `QuestionImage_courseId_contentHash_idx`;
ALTER TABLE `QuestionImage` DROP INDEX `QuestionImage_courseId_id_key`;
ALTER TABLE `QuestionImage` DROP INDEX `QuestionImage_courseId_questionId_field_sortOrder_idx`;
ALTER TABLE `QuestionRevision` DROP INDEX `QuestionRevision_courseId_questionId_createdAt_idx`;
ALTER TABLE `QuestionRevision` DROP INDEX `QuestionRevision_courseId_questionId_revision_key`;
ALTER TABLE `WrongQuestion` DROP INDEX `WrongQuestion_courseId_questionId_fkey`;
ALTER TABLE `WrongQuestion` DROP INDEX `WrongQuestion_courseId_userId_mastered_idx`;
ALTER TABLE `WrongQuestion` DROP INDEX `WrongQuestion_courseId_userId_questionId_key`;

-- Phase 3: drop the courseId columns
ALTER TABLE `ExamDraft` DROP COLUMN `courseId`;
ALTER TABLE `ExamRule` DROP COLUMN `courseId`;
ALTER TABLE `ImportBatch` DROP COLUMN `courseId`;
ALTER TABLE `KnowledgePoint` DROP COLUMN `courseId`;
ALTER TABLE `KnowledgePracticeRule` DROP COLUMN `courseId`;
ALTER TABLE `Level` DROP COLUMN `courseId`;
ALTER TABLE `LevelPracticeRule` DROP COLUMN `courseId`;
ALTER TABLE `PracticeAnswer` DROP COLUMN `courseId`;
ALTER TABLE `PracticeSession` DROP COLUMN `courseId`;
ALTER TABLE `PracticeSessionQuestion` DROP COLUMN `courseId`;
ALTER TABLE `Question` DROP COLUMN `courseId`;
ALTER TABLE `QuestionImage` DROP COLUMN `courseId`;
ALTER TABLE `QuestionRevision` DROP COLUMN `courseId`;
ALTER TABLE `WrongQuestion` DROP COLUMN `courseId`;

-- Phase 4: drop the Course table
DROP TABLE `Course`;

-- Phase 5: recreate indexes and foreign keys in the new single-domain shape
ALTER TABLE `ExamDraft` ADD UNIQUE INDEX `ExamDraft_sessionId_key`(`sessionId`);
ALTER TABLE `ExamDraft` ADD CONSTRAINT `ExamDraft_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PracticeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExamRule` ADD UNIQUE INDEX `ExamRule_levelId_key`(`levelId`);
ALTER TABLE `ExamRule` ADD CONSTRAINT `ExamRule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KnowledgePoint` ADD UNIQUE INDEX `KnowledgePoint_code_key`(`code`);
ALTER TABLE `KnowledgePoint` ADD UNIQUE INDEX `KnowledgePoint_path_key`(`path`);
ALTER TABLE `KnowledgePoint` ADD INDEX `KnowledgePoint_parentId_sortOrder_idx`(`parentId`, `sortOrder`);
ALTER TABLE `KnowledgePoint` ADD CONSTRAINT `KnowledgePoint_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `KnowledgePoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `KnowledgePracticeRule` ADD UNIQUE INDEX `KnowledgePracticeRule_knowledgePointId_levelId_key`(`knowledgePointId`, `levelId`);
ALTER TABLE `KnowledgePracticeRule` ADD INDEX `KnowledgePracticeRule_levelId_idx`(`levelId`);
ALTER TABLE `KnowledgePracticeRule` ADD CONSTRAINT `KnowledgePracticeRule_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `KnowledgePoint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KnowledgePracticeRule` ADD CONSTRAINT `KnowledgePracticeRule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Level` ADD UNIQUE INDEX `Level_code_key`(`code`);
ALTER TABLE `Level` ADD INDEX `Level_enabled_sortOrder_idx`(`enabled`, `sortOrder`);
ALTER TABLE `LevelPracticeRule` ADD UNIQUE INDEX `LevelPracticeRule_levelId_key`(`levelId`);
ALTER TABLE `LevelPracticeRule` ADD CONSTRAINT `LevelPracticeRule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PracticeAnswer` ADD INDEX `PracticeAnswer_questionId_isCorrect_idx`(`questionId`, `isCorrect`);
ALTER TABLE `PracticeAnswer` ADD UNIQUE INDEX `PracticeAnswer_sessionId_questionId_key`(`sessionId`, `questionId`);
ALTER TABLE `PracticeAnswer` ADD UNIQUE INDEX `PracticeAnswer_sessionId_idempotencyKey_key`(`sessionId`, `idempotencyKey`);
ALTER TABLE `PracticeAnswer` ADD CONSTRAINT `PracticeAnswer_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PracticeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PracticeAnswer` ADD CONSTRAINT `PracticeAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PracticeSession` ADD CONSTRAINT `PracticeSession_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PracticeSession` ADD CONSTRAINT `PracticeSession_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `KnowledgePoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PracticeSessionQuestion` ADD UNIQUE INDEX `PracticeSessionQuestion_sessionId_questionId_key`(`sessionId`, `questionId`);
ALTER TABLE `PracticeSessionQuestion` ADD UNIQUE INDEX `PracticeSessionQuestion_sessionId_position_key`(`sessionId`, `position`);
ALTER TABLE `PracticeSessionQuestion` ADD CONSTRAINT `PracticeSessionQuestion_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PracticeSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PracticeSessionQuestion` ADD CONSTRAINT `PracticeSessionQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Question` ADD INDEX `Question_levelId_type_status_idx`(`levelId`, `type`, `status`);
ALTER TABLE `Question` ADD INDEX `Question_knowledgePointId_levelId_type_status_idx`(`knowledgePointId`, `levelId`, `type`, `status`);
ALTER TABLE `Question` ADD INDEX `Question_externalQuestionCode_idx`(`externalQuestionCode`);
ALTER TABLE `Question` ADD UNIQUE INDEX `Question_levelId_externalQuestionCode_key`(`levelId`, `externalQuestionCode`);
ALTER TABLE `Question` ADD CONSTRAINT `Question_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Question` ADD CONSTRAINT `Question_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `KnowledgePoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Question` ADD CONSTRAINT `Question_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `ImportBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `QuestionImage` ADD INDEX `QuestionImage_questionId_field_sortOrder_idx`(`questionId`, `field`, `sortOrder`);
ALTER TABLE `QuestionImage` ADD INDEX `QuestionImage_contentHash_idx`(`contentHash`);
ALTER TABLE `QuestionImage` ADD CONSTRAINT `QuestionImage_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `QuestionRevision` ADD INDEX `QuestionRevision_questionId_createdAt_idx`(`questionId`, `createdAt`);
ALTER TABLE `QuestionRevision` ADD UNIQUE INDEX `QuestionRevision_questionId_revision_key`(`questionId`, `revision`);
ALTER TABLE `QuestionRevision` ADD CONSTRAINT `QuestionRevision_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- `WrongQuestion_userId_mastered_idx` already exists from the initial migration,
-- so only the missing single-column index is added here.
ALTER TABLE `WrongQuestion` ADD INDEX `WrongQuestion_userId_idx`(`userId`);
ALTER TABLE `WrongQuestion` ADD UNIQUE INDEX `WrongQuestion_userId_questionId_key`(`userId`, `questionId`);
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
