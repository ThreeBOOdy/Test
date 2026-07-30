-- AlterTable
ALTER TABLE `Question` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `KnowledgePoint` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `LevelPracticeRule` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `KnowledgePracticeRule` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `ExamRule` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `QuestionRevision` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio',
    `questionId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL,
    `snapshot` JSON NOT NULL,
    `changeSource` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `QuestionRevision_courseId_questionId_revision_key`(`courseId`, `questionId`, `revision`),
    INDEX `QuestionRevision_courseId_questionId_createdAt_idx`(`courseId`, `questionId`, `createdAt`),
    INDEX `QuestionRevision_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill existing questions with their initial retained state.
INSERT INTO `QuestionRevision` (`id`, `courseId`, `questionId`, `revision`, `snapshot`, `changeSource`, `createdAt`)
SELECT CONCAT('backfill-', `id`), `courseId`, `id`, 1,
  JSON_OBJECT(
    'levelId', `levelId`,
    'knowledgePointId', `knowledgePointId`,
    'sourceBankCode', `sourceBankCode`,
    'externalQuestionCode', `externalQuestionCode`,
    'stem', `stem`,
    'options', `options`,
    'correctOptionIds', `correctOptionIds`,
    'status', `status`
  ),
  'MIGRATION_BACKFILL', `createdAt`
FROM `Question`;

-- AddForeignKey
ALTER TABLE `QuestionRevision` ADD CONSTRAINT `QuestionRevision_courseId_questionId_fkey` FOREIGN KEY (`courseId`, `questionId`) REFERENCES `Question`(`courseId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `QuestionRevision` ADD CONSTRAINT `QuestionRevision_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
