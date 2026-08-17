ALTER TABLE `User`
    ADD COLUMN `activationRequired` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `StudentActivation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `activationCodeHash` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudentActivation_userId_key`(`userId`),
    INDEX `StudentActivation_expiresAt_usedAt_idx`(`expiresAt`, `usedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `StudentActivation`
    ADD CONSTRAINT `StudentActivation_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
