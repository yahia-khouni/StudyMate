-- =====================================================
-- Migration: Add structured_content to materials table
-- =====================================================

SET @db_name = DATABASE();

-- Add structured_content column to store AI-processed content (if missing)
SET @col_exists = (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = @db_name
	  AND TABLE_NAME = 'materials'
	  AND COLUMN_NAME = 'structured_content'
);
SET @query = IF(
	@col_exists = 0,
	'ALTER TABLE materials ADD COLUMN structured_content LONGTEXT NULL AFTER extracted_text',
	'SELECT ''Column structured_content already exists'''
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add processed_at timestamp to track when processing completed (if missing)
SET @col_exists = (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = @db_name
	  AND TABLE_NAME = 'materials'
	  AND COLUMN_NAME = 'processed_at'
);
SET @query = IF(
	@col_exists = 0,
	'ALTER TABLE materials ADD COLUMN processed_at DATETIME NULL AFTER structured_content',
	'SELECT ''Column processed_at already exists'''
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
