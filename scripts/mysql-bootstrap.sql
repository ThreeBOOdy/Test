-- Replace CHANGE_ME_PRACTICE_PASSWORD before running this script.
-- Run with an administrative MySQL account, for example from MySQL Workbench.

CREATE DATABASE IF NOT EXISTS practice_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS practice_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS practice_ci_integration CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS practice_ci_migration CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS practice_ci_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'practice'@'localhost' IDENTIFIED BY '021010';
ALTER USER 'practice'@'localhost' IDENTIFIED BY '021010';
CREATE USER IF NOT EXISTS 'practice'@'127.0.0.1' IDENTIFIED BY '021010';
ALTER USER 'practice'@'127.0.0.1' IDENTIFIED BY '021010';

GRANT ALL PRIVILEGES ON practice_dev.* TO 'practice'@'localhost';
GRANT ALL PRIVILEGES ON practice_shadow.* TO 'practice'@'localhost';
GRANT ALL PRIVILEGES ON practice_ci_integration.* TO 'practice'@'localhost';
GRANT ALL PRIVILEGES ON practice_ci_migration.* TO 'practice'@'localhost';
GRANT ALL PRIVILEGES ON practice_ci_e2e.* TO 'practice'@'localhost';
GRANT ALL PRIVILEGES ON practice_dev.* TO 'practice'@'127.0.0.1';
GRANT ALL PRIVILEGES ON practice_shadow.* TO 'practice'@'127.0.0.1';
GRANT ALL PRIVILEGES ON practice_ci_integration.* TO 'practice'@'127.0.0.1';
GRANT ALL PRIVILEGES ON practice_ci_migration.* TO 'practice'@'127.0.0.1';
GRANT ALL PRIVILEGES ON practice_ci_e2e.* TO 'practice'@'127.0.0.1';
FLUSH PRIVILEGES;
