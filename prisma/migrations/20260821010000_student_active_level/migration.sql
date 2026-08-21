-- Teacher-managed student active letter class (nullable).
-- This is the persistence basis for student-side access control:
-- teachers assign a nullable activeLevelId (A/B/C/... or unassigned).

-- Add the nullable column first; existing students remain unassigned.
ALTER TABLE `User` ADD COLUMN `activeLevelId` VARCHAR(191) NULL;

-- Index for list/filter by active level.
CREATE INDEX `User_activeLevelId_idx` ON `User`(`activeLevelId`);

-- A level can be disabled later, but existing assignments remain readable;
-- deleting a level that still has assigned students is blocked by RESTRICT.
ALTER TABLE `User` ADD CONSTRAINT `User_activeLevelId_fkey` FOREIGN KEY (`activeLevelId`) REFERENCES `Level`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
