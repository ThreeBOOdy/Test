-- Retain every public question revision so Question rows cannot be physically deleted.
ALTER TABLE `QuestionRevision` DROP FOREIGN KEY `QuestionRevision_courseId_questionId_fkey`;
ALTER TABLE `QuestionRevision` ADD CONSTRAINT `QuestionRevision_courseId_questionId_fkey`
  FOREIGN KEY (`courseId`, `questionId`) REFERENCES `Question`(`courseId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
