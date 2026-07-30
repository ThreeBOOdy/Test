ALTER TABLE `Course` DROP CHECK `Course_enabled_active_slot_check`;

ALTER TABLE `Course` ADD CONSTRAINT `Course_radio_activation_check`
CHECK (((`id` = 'course-radio' AND `code` = 'RADIO' AND `enabled` = true AND `activeSlot` = 1) OR (`id` <> 'course-radio' AND `code` <> 'RADIO' AND `enabled` = false AND `activeSlot` IS NULL)) IS TRUE);
