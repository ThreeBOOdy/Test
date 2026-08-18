-- S1: 题库 ABC 灵活化 — 数据模型与迁移
-- 1. KnowledgePointType 字典表
-- 2. KnowledgePoint.typeId 必填回填
-- 3. QuestionLevel 多字母类关联表，回填旧 Question.levelId
-- 4. Question.externalQuestionCode 全局唯一
-- 5. 删除 Question.levelId 旧列

-- CreateTable
CREATE TABLE `KnowledgePointType` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KnowledgePointType_code_key`(`code`),
    INDEX `KnowledgePointType_enabled_sortOrder_idx`(`enabled`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the default knowledge point type for existing trees.
INSERT INTO `KnowledgePointType` (`id`, `code`, `name`, `sortOrder`, `enabled`, `createdAt`, `updatedAt`) VALUES
    ('knowledge-point-type-default', 'DEFAULT', '默认', 0, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- Add typeId as nullable first so existing rows can be backfilled.
ALTER TABLE `KnowledgePoint` ADD COLUMN `typeId` VARCHAR(191) NULL;

-- Backfill every existing knowledge point into the default type.
UPDATE `KnowledgePoint` SET `typeId` = 'knowledge-point-type-default' WHERE `typeId` IS NULL;

-- Enforce NOT NULL now that all rows are assigned.
ALTER TABLE `KnowledgePoint` MODIFY `typeId` VARCHAR(191) NOT NULL;

-- Drop old globally unique constraints that are replaced by per-type uniqueness.
DROP INDEX `KnowledgePoint_code_key` ON `KnowledgePoint`;
DROP INDEX `KnowledgePoint_path_key` ON `KnowledgePoint`;

-- DropForeignKey
ALTER TABLE `Question` DROP FOREIGN KEY `Question_levelId_fkey`;

-- DropForeignKey
ALTER TABLE `Question` DROP FOREIGN KEY `Question_knowledgePointId_fkey`;

-- DropIndex (old single-level indexes/constraints)
DROP INDEX `Question_levelId_type_status_idx` ON `Question`;
DROP INDEX `Question_knowledgePointId_levelId_type_status_idx` ON `Question`;
DROP INDEX `Question_levelId_externalQuestionCode_key` ON `Question`;

-- CreateTable
CREATE TABLE `QuestionLevel` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuestionLevel_levelId_idx`(`levelId`),
    UNIQUE INDEX `QuestionLevel_questionId_levelId_key`(`questionId`, `levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Align new table collation with existing tables so FK constraints stay valid on both MySQL and MariaDB.
SET @kpCollation = (SELECT `TABLE_COLLATION` FROM `information_schema`.`TABLES` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'KnowledgePoint' LIMIT 1);
SET @sql = CONCAT('ALTER TABLE `KnowledgePointType` CONVERT TO CHARACTER SET utf8mb4 COLLATE ', @kpCollation);
PREPARE dynamicStmt FROM @sql; EXECUTE dynamicStmt; DEALLOCATE PREPARE dynamicStmt;

SET @qCollation = (SELECT `TABLE_COLLATION` FROM `information_schema`.`TABLES` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'Question' LIMIT 1);
SET @sql = CONCAT('ALTER TABLE `QuestionLevel` CONVERT TO CHARACTER SET utf8mb4 COLLATE ', @qCollation);
PREPARE dynamicStmt FROM @sql; EXECUTE dynamicStmt; DEALLOCATE PREPARE dynamicStmt;

-- Backfill QuestionLevel from the legacy single-value Question.levelId.
INSERT INTO `QuestionLevel` (`id`, `questionId`, `levelId`, `createdAt`)
SELECT CONCAT('question-level-', `id`), `id`, `levelId`, CURRENT_TIMESTAMP(3)
FROM `Question`
WHERE `levelId` IS NOT NULL;

-- Drop the legacy column now that its data has been moved.
ALTER TABLE `Question` DROP COLUMN `levelId`;

-- CreateIndex
CREATE INDEX `KnowledgePoint_typeId_enabled_depth_idx` ON `KnowledgePoint`(`typeId`, `enabled`, `depth`);
CREATE UNIQUE INDEX `KnowledgePoint_typeId_code_key` ON `KnowledgePoint`(`typeId`, `code`);

-- CreateIndex
CREATE UNIQUE INDEX `Question_externalQuestionCode_key` ON `Question`(`externalQuestionCode`);
CREATE INDEX `Question_type_status_idx` ON `Question`(`type`, `status`);
CREATE INDEX `Question_knowledgePointId_type_status_idx` ON `Question`(`knowledgePointId`, `type`, `status`);

-- AddForeignKey
ALTER TABLE `KnowledgePoint` ADD CONSTRAINT `KnowledgePoint_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `KnowledgePointType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Question` ADD CONSTRAINT `Question_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `KnowledgePoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `QuestionLevel` ADD CONSTRAINT `QuestionLevel_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `QuestionLevel` ADD CONSTRAINT `QuestionLevel_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
