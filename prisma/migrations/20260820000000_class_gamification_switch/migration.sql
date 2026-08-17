-- Add a teacher-controlled class/grade gamification display switch.
ALTER TABLE `Grade` ADD COLUMN `gamificationEnabled` BOOLEAN NOT NULL DEFAULT true;
