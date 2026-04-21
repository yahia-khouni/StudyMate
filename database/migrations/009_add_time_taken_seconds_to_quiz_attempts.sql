-- =====================================================
-- Migration: Add time_taken_seconds to quiz_attempts table
-- =====================================================

SET @db_name = DATABASE();

SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'quiz_attempts'
      AND COLUMN_NAME = 'time_taken_seconds'
);

SET @query = IF(
    @col_exists = 0,
    'ALTER TABLE quiz_attempts ADD COLUMN time_taken_seconds INT NULL AFTER passed',
    'SELECT ''Column time_taken_seconds already exists in quiz_attempts'''
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
