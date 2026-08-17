-- Add a dedicated "show learning map entry" flag to PlayerProfile.
-- This is the hidden-entry switch for the knowledge map (issue 11).
-- It defaults to enabled so existing students immediately see the map entry.

ALTER TABLE `PlayerProfile` ADD COLUMN `mapEnabled` BOOLEAN NOT NULL DEFAULT true;
