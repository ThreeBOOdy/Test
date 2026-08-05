-- Question-level image storage: image binaries live in MySQL and are never
-- physically deleted (ADR 0003), so question ownership uses ON DELETE RESTRICT.
-- `field` is "STEM" for the stem or the option id (e.g. "A") for an option image.
CREATE TABLE `QuestionImage` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL DEFAULT 'course-radio',
    `questionId` VARCHAR(191) NOT NULL,
    `field` VARCHAR(32) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `data` LONGBLOB NOT NULL,
    `mimeType` VARCHAR(64) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `contentHash` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuestionImage_courseId_id_key`(`courseId`, `id`),
    INDEX `QuestionImage_courseId_questionId_field_sortOrder_idx`(`courseId`, `questionId`, `field`, `sortOrder`),
    INDEX `QuestionImage_courseId_contentHash_idx`(`courseId`, `contentHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `QuestionImage` ADD CONSTRAINT `QuestionImage_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `QuestionImage` ADD CONSTRAINT `QuestionImage_courseId_questionId_fkey` FOREIGN KEY (`courseId`, `questionId`) REFERENCES `Question`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
