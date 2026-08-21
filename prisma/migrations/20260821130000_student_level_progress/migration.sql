-- Issue #9: sequential practice resume position and completed-round counter.
-- Tracks one row per student per letter-class level. lastIndex is the number of
-- questions completed in the current round (0 = start of a round); completing the
-- final question resets it to 0 and increments roundCount.

-- CreateTable
CREATE TABLE `StudentLevelProgress` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `lastIndex` INTEGER NOT NULL DEFAULT 0,
    `roundCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudentLevelProgress_userId_levelId_key`(`userId`, `levelId`),
    INDEX `StudentLevelProgress_levelId_idx`(`levelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `StudentLevelProgress` ADD CONSTRAINT `StudentLevelProgress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `StudentLevelProgress` ADD CONSTRAINT `StudentLevelProgress_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
