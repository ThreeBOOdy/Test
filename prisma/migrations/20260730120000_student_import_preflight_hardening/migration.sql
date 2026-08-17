ALTER TABLE `StudentImportRow`
    DROP COLUMN `initialPasswordEncrypted`,
    ADD COLUMN `initialPasswordHash` TEXT NULL;
