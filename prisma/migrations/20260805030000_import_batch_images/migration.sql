-- Batch-level image storage for Word preflight: binaries extracted from the
-- uploaded file live here during preview with a stable qimg_* id so the
-- [图:qimg_xxx] markers in ImportBatchRow payload stay valid when commit
-- migrates the same ids into QuestionImage (ADR 0002/0003).
-- Preview batches are temporary data, so images cascade-delete with the batch.
CREATE TABLE `ImportBatchImage` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `rowNumber` INTEGER NOT NULL,
    `field` VARCHAR(32) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `data` LONGBLOB NOT NULL,
    `mimeType` VARCHAR(64) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `contentHash` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ImportBatchImage_batchId_rowNumber_field_sortOrder_idx`(`batchId`, `rowNumber`, `field`, `sortOrder`),
    UNIQUE INDEX `ImportBatchImage_batchId_id_key`(`batchId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `ImportBatchImage` ADD CONSTRAINT `ImportBatchImage_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ImportBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
