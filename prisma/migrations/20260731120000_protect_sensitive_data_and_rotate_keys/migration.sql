-- AlterTable
ALTER TABLE `AuthSession` ADD COLUMN `reverifiedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `SensitiveDataReauthenticationAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `ipHash` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SensitiveDataReauth_user_success_createdAt_idx`(`userId`, `success`, `createdAt`),
    INDEX `SensitiveDataReauth_ip_success_createdAt_idx`(`ipHash`, `success`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
