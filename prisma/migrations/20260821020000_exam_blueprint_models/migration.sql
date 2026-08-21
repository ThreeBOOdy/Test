-- Issue #15: ExamBlueprint / ExamBlueprintItem 数据模型 + 默认蓝图迁移
-- 1. 新增 ExamBlueprint（每个字母类可有多套命名模拟测试蓝图）
-- 2. 新增 ExamBlueprintItem（按知识点固定单选/多选数量）
-- 3. 把旧 ExamRule 迁移为每个字母类的默认蓝图，并拆出对应条目

-- CreateTable
CREATE TABLE `ExamBlueprint` (
    `id` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `durationMinutes` INTEGER NULL,
    `passingCount` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExamBlueprint_levelId_name_key`(`levelId`, `name`),
    INDEX `ExamBlueprint_levelId_isDefault_enabled_idx`(`levelId`, `isDefault`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `ExamBlueprintItem` (
    `id` VARCHAR(191) NOT NULL,
    `blueprintId` VARCHAR(191) NOT NULL,
    `knowledgePointId` VARCHAR(191) NOT NULL,
    `singleCount` INTEGER NOT NULL DEFAULT 0,
    `multipleCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExamBlueprintItem_blueprintId_knowledgePointId_key`(`blueprintId`, `knowledgePointId`),
    INDEX `ExamBlueprintItem_knowledgePointId_idx`(`knowledgePointId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `ExamBlueprint` ADD CONSTRAINT `ExamBlueprint_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExamBlueprintItem` ADD CONSTRAINT `ExamBlueprintItem_blueprintId_fkey` FOREIGN KEY (`blueprintId`) REFERENCES `ExamBlueprint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExamBlueprintItem` ADD CONSTRAINT `ExamBlueprintItem_knowledgePointId_fkey` FOREIGN KEY (`knowledgePointId`) REFERENCES `KnowledgePoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- MIGRATION_BACKFILL: 旧 ExamRule -> 每个字母类的默认 ExamBlueprint。
-- 每个 Level 只有一条 ExamRule，因此迁移成一条 isDefault=true 的蓝图。
INSERT INTO `ExamBlueprint` (`id`, `levelId`, `name`, `durationMinutes`, `passingCount`, `enabled`, `isDefault`, `createdAt`, `updatedAt`)
SELECT
    CONCAT('exam-blueprint-', `id`),
    `levelId`,
    '默认模拟测试',
    `durationMinutes`,
    `passingCount`,
    `enabled`,
    TRUE,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM `ExamRule`;

-- 默认蓝图条目：优先按现有 KnowledgePracticeRule 的比例拆分；
-- 没有专项规则的知识点则按该字母类下 ACTIVE 题目库存拆分；
-- 若完全没有可拆分依据，则回退到第一个知识点承载全部题量，
-- 保证默认蓝图存在且总题量等于旧 ExamRule。
CREATE TEMPORARY TABLE `_ExamBlueprintAllocation` (
    `blueprintId` VARCHAR(191) NOT NULL,
    `knowledgePointId` VARCHAR(191) NOT NULL,
    `singleWeight` INT NOT NULL DEFAULT 0,
    `multipleWeight` INT NOT NULL DEFAULT 0,
    `singleAllocated` INT NOT NULL DEFAULT 0,
    `multipleAllocated` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`blueprintId`, `knowledgePointId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT INTO `_ExamBlueprintAllocation` (`blueprintId`, `knowledgePointId`, `singleWeight`, `multipleWeight`)
SELECT b.id, kpr.knowledgePointId, kpr.singleCount, kpr.multipleCount
FROM `ExamBlueprint` b
JOIN `KnowledgePracticeRule` kpr ON kpr.levelId = b.levelId AND kpr.enabled = TRUE
WHERE kpr.singleCount > 0 OR kpr.multipleCount > 0;

INSERT INTO `_ExamBlueprintAllocation` (`blueprintId`, `knowledgePointId`, `singleWeight`, `multipleWeight`)
SELECT b.id, q.knowledgePointId,
    SUM(CASE WHEN q.type = 'SINGLE_CHOICE' AND q.status = 'ACTIVE' THEN 1 ELSE 0 END),
    SUM(CASE WHEN q.type = 'MULTIPLE_CHOICE' AND q.status = 'ACTIVE' THEN 1 ELSE 0 END)
FROM `ExamBlueprint` b
JOIN `QuestionLevel` ql ON ql.levelId = b.levelId
JOIN `Question` q ON q.id = ql.questionId
JOIN `KnowledgePoint` kp ON kp.id = q.knowledgePointId AND kp.enabled = TRUE
GROUP BY b.id, q.knowledgePointId
ON DUPLICATE KEY UPDATE `singleWeight` = `singleWeight`, `multipleWeight` = `multipleWeight`;

INSERT INTO `_ExamBlueprintAllocation` (`blueprintId`, `knowledgePointId`, `singleWeight`, `multipleWeight`)
SELECT b.id, fallback.id, r.singleCount, r.multipleCount
FROM `ExamBlueprint` b
JOIN `ExamRule` r ON r.levelId = b.levelId
LEFT JOIN `_ExamBlueprintAllocation` a ON a.blueprintId = b.id
CROSS JOIN (
    SELECT `id` FROM `KnowledgePoint`
    ORDER BY `depth` ASC, `sortOrder` ASC, `id` ASC
    LIMIT 1
) fallback
WHERE a.blueprintId IS NULL;

UPDATE `_ExamBlueprintAllocation` a
JOIN `ExamBlueprint` b ON b.id = a.blueprintId
JOIN `ExamRule` r ON r.levelId = b.levelId
JOIN (
    SELECT `blueprintId`, SUM(`singleWeight`) AS `singleWeightTotal`, SUM(`multipleWeight`) AS `multipleWeightTotal`
    FROM `_ExamBlueprintAllocation`
    GROUP BY `blueprintId`
) totals ON totals.blueprintId = a.blueprintId
SET
    a.singleAllocated = IF(totals.singleWeightTotal > 0, FLOOR(r.singleCount * a.singleWeight / totals.singleWeightTotal), 0),
    a.multipleAllocated = IF(totals.multipleWeightTotal > 0, FLOOR(r.multipleCount * a.multipleWeight / totals.multipleWeightTotal), 0);

INSERT INTO `ExamBlueprintItem` (`id`, `blueprintId`, `knowledgePointId`, `singleCount`, `multipleCount`, `createdAt`, `updatedAt`)
SELECT
    CONCAT('exam-blueprint-item-', a.blueprintId, '-', a.knowledgePointId),
    a.blueprintId,
    a.knowledgePointId,
    a.singleAllocated,
    a.multipleAllocated,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM `_ExamBlueprintAllocation` a;

-- 把按比例取整产生的余数补到权重最大的条目上，确保总题量等于旧 ExamRule。
UPDATE `ExamBlueprintItem` i
JOIN `_ExamBlueprintAllocation` a ON a.blueprintId = i.blueprintId AND a.knowledgePointId = i.knowledgePointId
JOIN `ExamBlueprint` b ON b.id = i.blueprintId
JOIN `ExamRule` r ON r.levelId = b.levelId
JOIN (
    SELECT `blueprintId`, SUM(`singleAllocated`) AS `singleSum`, SUM(`multipleAllocated`) AS `multipleSum`
    FROM `_ExamBlueprintAllocation`
    GROUP BY `blueprintId`
) sums ON sums.blueprintId = i.blueprintId
JOIN (
    SELECT a3.blueprintId, a3.knowledgePointId,
           ROW_NUMBER() OVER (PARTITION BY a3.blueprintId ORDER BY (a3.singleWeight + a3.multipleWeight) DESC, a3.knowledgePointId ASC) AS `rn`
    FROM `_ExamBlueprintAllocation` a3
) top ON top.blueprintId = i.blueprintId AND top.knowledgePointId = i.knowledgePointId AND top.rn = 1
SET
    i.singleCount = i.singleCount + r.singleCount - sums.singleSum,
    i.multipleCount = i.multipleCount + r.multipleCount - sums.multipleSum;

-- 移除纯 0 条目；余数已补到权重最大的条目上。
DELETE FROM `ExamBlueprintItem` WHERE `singleCount` = 0 AND `multipleCount` = 0;

DROP TEMPORARY TABLE `_ExamBlueprintAllocation`;
