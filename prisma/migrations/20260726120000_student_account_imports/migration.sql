-- CreateTable
CREATE TABLE `StudentImportBatch` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `status` ENUM('PREVIEW', 'COMMITTED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PREVIEW',
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `validRows` INTEGER NOT NULL DEFAULT 0,
    `errorRows` INTEGER NOT NULL DEFAULT 0,
    `sheetNames` JSON NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `committedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudentImportBatch_createdById_status_createdAt_idx`(`createdById`, `status`, `createdAt`),
    INDEX `StudentImportBatch_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `StudentImportRow` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `sheetName` VARCHAR(191) NOT NULL,
    `sourceRowNumber` INTEGER NOT NULL,
    `payload` JSON NOT NULL,
    `initialPasswordEncrypted` TEXT NULL,
    `issues` JSON NOT NULL,
    `valid` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudentImportRow_batchId_sheetName_sourceRowNumber_key`(`batchId`, `sheetName`, `sourceRowNumber`),
    INDEX `StudentImportRow_batchId_valid_sheetName_sourceRowNumber_idx`(`batchId`, `valid`, `sheetName`, `sourceRowNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `StudentImportBatch` ADD CONSTRAINT `StudentImportBatch_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentImportRow` ADD CONSTRAINT `StudentImportRow_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `StudentImportBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
