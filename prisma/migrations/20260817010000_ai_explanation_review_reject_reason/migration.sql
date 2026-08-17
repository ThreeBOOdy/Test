-- AlterTable: store teacher rejection reason for AI explanation review.
ALTER TABLE `Question` ADD COLUMN `explanationRejectReason` TEXT NULL;
