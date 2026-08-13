-- Remove the single-course boundary: drop the Course table and every courseId
-- column in place. Data in all other columns is preserved.
-- Phase order matters: child foreign keys must be dropped before the parent
-- indexes they rely on, so we drop all foreign keys first, then indexes,
-- then columns, then the Course table, and finally recreate the new shape.

-- Phase 1: drop every foreign key that involves courseId
ALTER TABLE `examdraft` DROP FOREIGN KEY `ExamDraft_courseId_fkey`;
ALTER TABLE `examdraft` DROP FOREIGN KEY `ExamDraft_courseId_sessionId_fkey`;
ALTER TABLE `examrule` DROP FOREIGN KEY `ExamRule_courseId_fkey`;
ALTER TABLE `examrule` DROP FOREIGN KEY `ExamRule_courseId_levelId_fkey`;
ALTER TABLE `importbatch` DROP FOREIGN KEY `ImportBatch_courseId_fkey`;
ALTER TABLE `knowledgepoint` DROP FOREIGN KEY `KnowledgePoint_courseId_fkey`;
ALTER TABLE `knowledgepoint` DROP FOREIGN KEY `KnowledgePoint_courseId_parentId_fkey`;
ALTER TABLE `knowledgepracticerule` DROP FOREIGN KEY `KnowledgePracticeRule_courseId_fkey`;
ALTER TABLE `knowledgepracticerule` DROP FOREIGN KEY `KnowledgePracticeRule_courseId_knowledgePointId_fkey`;
ALTER TABLE `knowledgepracticerule` DROP FOREIGN KEY `KnowledgePracticeRule_courseId_levelId_fkey`;
ALTER TABLE `level` DROP FOREIGN KEY `Level_courseId_fkey`;
ALTER TABLE `levelpracticerule` DROP FOREIGN KEY `LevelPracticeRule_courseId_fkey`;
ALTER TABLE `levelpracticerule` DROP FOREIGN KEY `LevelPracticeRule_courseId_levelId_fkey`;
ALTER TABLE `practiceanswer` DROP FOREIGN KEY `PracticeAnswer_courseId_fkey`;
ALTER TABLE `practiceanswer` DROP FOREIGN KEY `PracticeAnswer_courseId_questionId_fkey`;
ALTER TABLE `practiceanswer` DROP FOREIGN KEY `PracticeAnswer_courseId_sessionId_fkey`;
ALTER TABLE `practicesession` DROP FOREIGN KEY `PracticeSession_courseId_fkey`;
ALTER TABLE `practicesession` DROP FOREIGN KEY `PracticeSession_courseId_knowledgePointId_fkey`;
ALTER TABLE `practicesession` DROP FOREIGN KEY `PracticeSession_courseId_levelId_fkey`;
ALTER TABLE `practicesessionquestion` DROP FOREIGN KEY `PracticeSessionQuestion_courseId_fkey`;
ALTER TABLE `practicesessionquestion` DROP FOREIGN KEY `PracticeSessionQuestion_courseId_questionId_fkey`;
ALTER TABLE `practicesessionquestion` DROP FOREIGN KEY `PracticeSessionQuestion_courseId_sessionId_fkey`;
ALTER TABLE `question` DROP FOREIGN KEY `Question_courseId_fkey`;
ALTER TABLE `question` DROP FOREIGN KEY `Question_courseId_importBatchId_fkey`;
ALTER TABLE `question` DROP FOREIGN KEY `Question_courseId_knowledgePointId_fkey`;
ALTER TABLE `question` DROP FOREIGN KEY `Question_courseId_levelId_fkey`;
ALTER TABLE `questionimage` DROP FOREIGN KEY `QuestionImage_courseId_fkey`;
ALTER TABLE `questionimage` DROP FOREIGN KEY `QuestionImage_courseId_questionId_fkey`;
ALTER TABLE `questionrevision` DROP FOREIGN KEY `QuestionRevision_courseId_questionId_fkey`;
ALTER TABLE `wrongquestion` DROP FOREIGN KEY `WrongQuestion_courseId_fkey`;
ALTER TABLE `wrongquestion` DROP FOREIGN KEY `WrongQuestion_courseId_questionId_fkey`;

-- Phase 2: drop every index that contains courseId
ALTER TABLE `examdraft` DROP INDEX `ExamDraft_courseId_sessionId_key`;
ALTER TABLE `examrule` DROP INDEX `ExamRule_courseId_levelId_key`;
ALTER TABLE `importbatch` DROP INDEX `ImportBatch_courseId_id_key`;
ALTER TABLE `knowledgepoint` DROP INDEX `KnowledgePoint_courseId_code_key`;
ALTER TABLE `knowledgepoint` DROP INDEX `KnowledgePoint_courseId_id_key`;
ALTER TABLE `knowledgepoint` DROP INDEX `KnowledgePoint_courseId_parentId_sortOrder_idx`;
ALTER TABLE `knowledgepoint` DROP INDEX `KnowledgePoint_courseId_path_key`;
ALTER TABLE `knowledgepracticerule` DROP INDEX `KnowledgePracticeRule_courseId_knowledgePointId_levelId_key`;
ALTER TABLE `knowledgepracticerule` DROP INDEX `KnowledgePracticeRule_courseId_levelId_idx`;
ALTER TABLE `level` DROP INDEX `Level_courseId_code_key`;
ALTER TABLE `level` DROP INDEX `Level_courseId_enabled_sortOrder_idx`;
ALTER TABLE `level` DROP INDEX `Level_courseId_id_key`;
ALTER TABLE `levelpracticerule` DROP INDEX `LevelPracticeRule_courseId_levelId_key`;
ALTER TABLE `practiceanswer` DROP INDEX `PracticeAnswer_courseId_questionId_isCorrect_idx`;
ALTER TABLE `practiceanswer` DROP INDEX `PracticeAnswer_courseId_sessionId_idempotencyKey_key`;
ALTER TABLE `practiceanswer` DROP INDEX `PracticeAnswer_courseId_sessionId_questionId_key`;
ALTER TABLE `practicesession` DROP INDEX `PracticeSession_courseId_id_key`;
ALTER TABLE `practicesession` DROP INDEX `PracticeSession_courseId_knowledgePointId_fkey`;
ALTER TABLE `practicesession` DROP INDEX `PracticeSession_courseId_levelId_fkey`;
ALTER TABLE `practicesessionquestion` DROP INDEX `PracticeSessionQuestion_courseId_questionId_fkey`;
ALTER TABLE `practicesessionquestion` DROP INDEX `PracticeSessionQuestion_courseId_sessionId_position_key`;
ALTER TABLE `practicesessionquestion` DROP INDEX `PracticeSessionQuestion_courseId_sessionId_questionId_key`;
ALTER TABLE `question` DROP INDEX `Question_courseId_externalQuestionCode_idx`;
ALTER TABLE `question` DROP INDEX `Question_courseId_id_key`;
ALTER TABLE `question` DROP INDEX `Question_courseId_importBatchId_fkey`;
ALTER TABLE `question` DROP INDEX `Question_courseId_knowledgePointId_levelId_type_status_idx`;
ALTER TABLE `question` DROP INDEX `Question_courseId_levelId_externalQuestionCode_key`;
ALTER TABLE `question` DROP INDEX `Question_courseId_levelId_type_status_idx`;
ALTER TABLE `questionimage` DROP INDEX `QuestionImage_courseId_contentHash_idx`;
ALTER TABLE `questionimage` DROP INDEX `QuestionImage_courseId_id_key`;
ALTER TABLE `questionimage` DROP INDEX `QuestionImage_courseId_questionId_field_sortOrder_idx`;
ALTER TABLE `questionrevision` DROP INDEX `QuestionRevision_courseId_questionId_createdAt_idx`;
ALTER TABLE `questionrevision` DROP INDEX `QuestionRevision_courseId_questionId_revision_key`;
ALTER TABLE `wrongquestion` DROP INDEX `WrongQuestion_courseId_questionId_fkey`;
ALTER TABLE `wrongquestion` DROP INDEX `WrongQuestion_courseId_userId_mastered_idx`;
ALTER TABLE `wrongquestion` DROP INDEX `WrongQuestion_courseId_userId_questionId_key`;

-- Phase 3: drop the courseId columns
ALTER TABLE `examdraft` DROP COLUMN `courseId`;
ALTER TABLE `examrule` DROP COLUMN `courseId`;
ALTER TABLE `importbatch` DROP COLUMN `courseId`;
ALTER TABLE `knowledgepoint` DROP COLUMN `courseId`;
ALTER TABLE `knowledgepracticerule` DROP COLUMN `courseId`;
ALTER TABLE `level` DROP COLUMN `courseId`;
ALTER TABLE `levelpracticerule` DROP COLUMN `courseId`;
ALTER TABLE `practiceanswer` DROP COLUMN `courseId`;
ALTER TABLE `practicesession` DROP COLUMN `courseId`;
ALTER TABLE `practicesessionquestion` DROP COLUMN `courseId`;
ALTER TABLE `question` DROP COLUMN `courseId`;
ALTER TABLE `questionimage` DROP COLUMN `courseId`;
ALTER TABLE `questionrevision` DROP COLUMN `courseId`;
ALTER TABLE `wrongquestion` DROP COLUMN `courseId`;

-- Phase 4: drop the Course table
DROP TABLE `course`;

-- Phase 5: recreate indexes and foreign keys in the new single-domain shape
ALTER TABLE `examdraft` ADD UNIQUE INDEX `ExamDraft_sessionId_key`(`sessionId`);
ALTER TABLE `examdraft` ADD CONSTRAINT `ExamDraft_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `practicesession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `examrule` ADD UNIQUE INDEX `ExamRule_levelId_key`(`levelId`);
ALTER TABLE `examrule` ADD CONSTRAINT `ExamRule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `knowledgepoint` ADD UNIQUE INDEX `KnowledgePoint_code_key`(`code`);
ALTER TABLE `knowledgepoint` ADD UNIQUE INDEX `KnowledgePoint_path_key`(`path`);
ALTER TABLE `knowledgepoint` ADD INDEX `KnowledgePoint_parentId_sortOrder_idx`(`parentId`, `sortOrder`);
ALTER TABLE `knowledgepoint` ADD CONSTRAINT `KnowledgePoint_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `knowledgepoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `knowledgepracticerule` ADD UNIQUE INDEX `KnowledgePracticeRule_knowledgePointId_levelId_key`(`knowledgePointId`, `levelId`);
ALTER TABLE `knowledgepracticerule` ADD INDEX `KnowledgePracticeRule_levelId_idx`(`levelId`);
ALTER TABLE `knowledgepracticerule` ADD CONSTRAINT `KnowledgePracticeRule_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `knowledgepoint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `knowledgepracticerule` ADD CONSTRAINT `KnowledgePracticeRule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `level` ADD UNIQUE INDEX `Level_code_key`(`code`);
ALTER TABLE `level` ADD INDEX `Level_enabled_sortOrder_idx`(`enabled`, `sortOrder`);
ALTER TABLE `levelpracticerule` ADD UNIQUE INDEX `LevelPracticeRule_levelId_key`(`levelId`);
ALTER TABLE `levelpracticerule` ADD CONSTRAINT `LevelPracticeRule_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `practiceanswer` ADD INDEX `PracticeAnswer_questionId_isCorrect_idx`(`questionId`, `isCorrect`);
ALTER TABLE `practiceanswer` ADD UNIQUE INDEX `PracticeAnswer_sessionId_questionId_key`(`sessionId`, `questionId`);
ALTER TABLE `practiceanswer` ADD UNIQUE INDEX `PracticeAnswer_sessionId_idempotencyKey_key`(`sessionId`, `idempotencyKey`);
ALTER TABLE `practiceanswer` ADD CONSTRAINT `PracticeAnswer_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `practicesession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `practiceanswer` ADD CONSTRAINT `PracticeAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `practicesession` ADD CONSTRAINT `PracticeSession_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `practicesession` ADD CONSTRAINT `PracticeSession_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `knowledgepoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `practicesessionquestion` ADD UNIQUE INDEX `PracticeSessionQuestion_sessionId_questionId_key`(`sessionId`, `questionId`);
ALTER TABLE `practicesessionquestion` ADD UNIQUE INDEX `PracticeSessionQuestion_sessionId_position_key`(`sessionId`, `position`);
ALTER TABLE `practicesessionquestion` ADD CONSTRAINT `PracticeSessionQuestion_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `practicesession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `practicesessionquestion` ADD CONSTRAINT `PracticeSessionQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `question` ADD INDEX `Question_levelId_type_status_idx`(`levelId`, `type`, `status`);
ALTER TABLE `question` ADD INDEX `Question_knowledgePointId_levelId_type_status_idx`(`knowledgePointId`, `levelId`, `type`, `status`);
ALTER TABLE `question` ADD INDEX `Question_externalQuestionCode_idx`(`externalQuestionCode`);
ALTER TABLE `question` ADD UNIQUE INDEX `Question_levelId_externalQuestionCode_key`(`levelId`, `externalQuestionCode`);
ALTER TABLE `question` ADD CONSTRAINT `Question_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `level`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `question` ADD CONSTRAINT `Question_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `knowledgepoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `question` ADD CONSTRAINT `Question_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `importbatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `questionimage` ADD INDEX `QuestionImage_questionId_field_sortOrder_idx`(`questionId`, `field`, `sortOrder`);
ALTER TABLE `questionimage` ADD INDEX `QuestionImage_contentHash_idx`(`contentHash`);
ALTER TABLE `questionimage` ADD CONSTRAINT `QuestionImage_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `questionrevision` ADD INDEX `QuestionRevision_questionId_createdAt_idx`(`questionId`, `createdAt`);
ALTER TABLE `questionrevision` ADD UNIQUE INDEX `QuestionRevision_questionId_revision_key`(`questionId`, `revision`);
ALTER TABLE `questionrevision` ADD CONSTRAINT `QuestionRevision_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- `WrongQuestion_userId_mastered_idx` already exists from the initial migration,
-- so only the missing single-column index is added here.
ALTER TABLE `wrongquestion` ADD INDEX `WrongQuestion_userId_idx`(`userId`);
ALTER TABLE `wrongquestion` ADD UNIQUE INDEX `WrongQuestion_userId_questionId_key`(`userId`, `questionId`);
ALTER TABLE `wrongquestion` ADD CONSTRAINT `WrongQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
