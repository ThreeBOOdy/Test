-- Issue #14: teacher-controlled student self-service wrong-question clearing.
-- Default remains teacher-only; teachers can enable per-grade self-service clearing.
ALTER TABLE `Grade` ADD COLUMN `studentSelfWrongClearEnabled` BOOLEAN NOT NULL DEFAULT false;
