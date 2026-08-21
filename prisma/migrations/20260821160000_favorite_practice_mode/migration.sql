-- Issue #17: favorite list page + FAVORITE practice sessions.
-- Add the FAVORITE value to the PracticeMode MySQL enum.

-- AlterTable
ALTER TABLE `PracticeSession` MODIFY `mode` ENUM('LEVEL_COMPREHENSIVE', 'KNOWLEDGE_POINT', 'WRONG_QUESTION', 'QUESTION_ORDER', 'RANDOM_ALL', 'MOCK_EXAM', 'FAVORITE') NOT NULL;
