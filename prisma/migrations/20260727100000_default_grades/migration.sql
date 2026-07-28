-- Seed the default compulsory education grades for registration and imports.
INSERT INTO `Grade` (`id`, `code`, `name`, `sortOrder`, `enabled`, `createdAt`, `updatedAt`)
VALUES
    ('grade-primary-1', 'PRIMARY_1', '一年级', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('grade-primary-2', 'PRIMARY_2', '二年级', 2, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('grade-primary-3', 'PRIMARY_3', '三年级', 3, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('grade-primary-4', 'PRIMARY_4', '四年级', 4, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('grade-primary-5', 'PRIMARY_5', '五年级', 5, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('grade-primary-6', 'PRIMARY_6', '六年级', 6, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('grade-junior-1', 'JUNIOR_1', '七年级', 7, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('grade-junior-2', 'JUNIOR_2', '八年级', 8, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('grade-junior-3', 'JUNIOR_3', '九年级', 9, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
    `name` = VALUES(`name`),
    `sortOrder` = VALUES(`sortOrder`),
    `enabled` = true,
    `updatedAt` = CURRENT_TIMESTAMP(3);

-- Retire the former high-school demo grades when upgrading an existing seeded database.
UPDATE `Grade`
SET `enabled` = false, `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `code` IN ('SENIOR_1', 'SENIOR_2', 'SENIOR_3');
