-- CreateTable: light RPG foundation — player profile, level table, daily quest logs and XP audit trail.
-- Quest progress is driven by real learning behaviour; claiming a completed quest grants its XP reward.

CREATE TABLE `PlayerProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `xp` INTEGER NOT NULL DEFAULT 0,
    `level` INTEGER NOT NULL DEFAULT 1,
    `title` VARCHAR(191) NOT NULL DEFAULT '见习报务员',
    `gamificationEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlayerProfile_userId_key`(`userId`),
    INDEX `PlayerProfile_level_idx`(`level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlayerLevel` (
    `id` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `xpRequired` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlayerLevel_level_key`(`level`),
    INDEX `PlayerLevel_xpRequired_idx`(`xpRequired`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QuestLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questDate` DATE NOT NULL,
    `type` ENUM('PRACTICE', 'REVIEW', 'WRONG_CLEAR', 'FOCUS') NOT NULL,
    `target` INTEGER NOT NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS',
    `xpReward` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuestLog_userId_questDate_type_key`(`userId`, `questDate`, `type`),
    INDEX `QuestLog_userId_questDate_status_idx`(`userId`, `questDate`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `XpLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NULL,
    `sourceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `XpLog_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PlayerProfile` ADD CONSTRAINT `PlayerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `QuestLog` ADD CONSTRAINT `QuestLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `XpLog` ADD CONSTRAINT `XpLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the level/title ladder. XP thresholds are cumulative.
INSERT INTO `PlayerLevel` (`id`, `level`, `title`, `xpRequired`, `createdAt`, `updatedAt`) VALUES
    ('player-level-1', 1, '见习报务员', 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('player-level-2', 2, '见习报务员', 80, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('player-level-3', 3, '熟练操作员', 200, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('player-level-4', 4, '熟练操作员', 400, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('player-level-5', 5, '熟练操作员', 700, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('player-level-6', 6, '无线电专家', 1100, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('player-level-7', 7, '无线电专家', 1600, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('player-level-8', 8, '无线电专家', 2200, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('player-level-9', 9, '首席报务员', 3000, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('player-level-10', 10, '无线电大师', 4000, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- Backfill profiles for existing students so gamification starts without a lazy-create gap.
INSERT INTO `PlayerProfile` (`id`, `userId`, `xp`, `level`, `title`, `gamificationEnabled`, `createdAt`, `updatedAt`)
SELECT CONCAT('player-profile-', `id`), `id`, 0, 1, '见习报务员', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `User`
WHERE `role` = 'STUDENT'
  AND NOT EXISTS (SELECT 1 FROM `PlayerProfile` `p` WHERE `p`.`userId` = `User`.`id`);
