-- Issue #10: sequential practice learning/practice mode switch.
-- learningMode=false is the default "practice" mode; true means "learning" mode
-- which advances sequential progress without writing StudentLevelQuestionState.

-- AlterTable
ALTER TABLE `PracticeSession` ADD COLUMN `learningMode` BOOLEAN NOT NULL DEFAULT false;
