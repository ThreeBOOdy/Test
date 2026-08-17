ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX `WrongQuestion_userId_mastered_correctSessionCount_idx` ON `WrongQuestion`(`userId`, `mastered`, `correctSessionCount`);
ALTER TABLE `RadioPerson` MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
