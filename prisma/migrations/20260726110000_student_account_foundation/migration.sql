-- AlterTable
ALTER TABLE `User`
    MODIFY `role` ENUM('STUDENT', 'TEACHER', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    ADD COLUMN `studentStatus` ENUM('PENDING', 'ACTIVE', 'REJECTED') NULL,
    ADD COLUMN `registrationSource` ENUM('SELF_REGISTRATION', 'EXCEL_IMPORT', 'LEGACY') NULL,
    ADD COLUMN `nationalIdEncrypted` TEXT NULL,
    ADD COLUMN `nationalIdHash` VARCHAR(191) NULL,
    ADD COLUMN `nationalIdLast4` VARCHAR(4) NULL,
    ADD COLUMN `gender` ENUM('MALE', 'FEMALE') NULL,
    ADD COLUMN `school` VARCHAR(191) NULL,
    ADD COLUMN `gradeId` VARCHAR(191) NULL,
    ADD COLUMN `phoneEncrypted` TEXT NULL,
    ADD COLUMN `phoneHash` VARCHAR(191) NULL,
    ADD COLUMN `phoneLast4` VARCHAR(4) NULL,
    ADD COLUMN `submittedAt` DATETIME(3) NULL,
    ADD COLUMN `reviewedAt` DATETIME(3) NULL,
    ADD COLUMN `reviewedById` VARCHAR(191) NULL,
    ADD COLUMN `rejectionReason` TEXT NULL,
    ADD COLUMN `validFrom` DATE NULL,
    ADD COLUMN `validUntil` DATE NULL,
    ADD COLUMN `isLongTerm` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `profileIncomplete` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `Grade` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Grade_code_key`(`code`),
    UNIQUE INDEX `Grade_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `StudentReviewRecord` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `action` ENUM('SUBMITTED', 'PROFILE_UPDATED', 'RESUBMITTED', 'APPROVED', 'REJECTED') NOT NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `beforeStatus` ENUM('PENDING', 'ACTIVE', 'REJECTED') NULL,
    `afterStatus` ENUM('PENDING', 'ACTIVE', 'REJECTED') NULL,
    `rejectionReason` TEXT NULL,
    `profileSnapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StudentReviewRecord_studentId_createdAt_idx`(`studentId`, `createdAt`),
    INDEX `StudentReviewRecord_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `StudentReviewRecord_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_nationalIdHash_key` ON `User`(`nationalIdHash`);

-- CreateIndex
CREATE UNIQUE INDEX `User_phoneHash_key` ON `User`(`phoneHash`);

-- CreateIndex
CREATE INDEX `User_role_studentStatus_enabled_idx` ON `User`(`role`, `studentStatus`, `enabled`);

-- CreateIndex
CREATE INDEX `User_gradeId_studentStatus_idx` ON `User`(`gradeId`, `studentStatus`);

-- CreateIndex
CREATE INDEX `User_reviewedById_reviewedAt_idx` ON `User`(`reviewedById`, `reviewedAt`);

-- Backfill legacy student accounts without replacing User rows or IDs.
UPDATE `User`
SET
    `studentStatus` = 'ACTIVE',
    `registrationSource` = 'LEGACY',
    `isLongTerm` = true,
    `profileIncomplete` = true
WHERE `role` = 'STUDENT';

-- Promote only the historical seed administrator account.
UPDATE `User`
SET `role` = 'ADMIN'
WHERE `username` = 'teacher';

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_gradeId_fkey` FOREIGN KEY (`gradeId`) REFERENCES `Grade`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentReviewRecord` ADD CONSTRAINT `StudentReviewRecord_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentReviewRecord` ADD CONSTRAINT `StudentReviewRecord_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
