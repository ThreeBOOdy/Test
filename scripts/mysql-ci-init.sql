CREATE DATABASE IF NOT EXISTS practice_ci_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS practice_ci_migration CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON practice_ci_e2e.* TO 'practice'@'%';
GRANT ALL PRIVILEGES ON practice_ci_migration.* TO 'practice'@'%';
FLUSH PRIVILEGES;
