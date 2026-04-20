-- =====================================================
-- Migration: Add missing columns to quizzes and flashcard_decks tables
-- =====================================================

SET @db_name = DATABASE();

-- Add missing columns to quizzes table (if missing)
SET @col_exists = (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = @db_name
	  AND TABLE_NAME = 'quizzes'
	  AND COLUMN_NAME = 'title'
);
SET @query = IF(
	@col_exists = 0,
	'ALTER TABLE quizzes ADD COLUMN title VARCHAR(255) NULL AFTER chapter_id',
	'SELECT ''Column title already exists in quizzes'''
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = @db_name
	  AND TABLE_NAME = 'quizzes'
	  AND COLUMN_NAME = 'difficulty'
);
SET @query = IF(
	@col_exists = 0,
	'ALTER TABLE quizzes ADD COLUMN difficulty ENUM(''easy'', ''medium'', ''hard'') DEFAULT ''medium'' AFTER language',
	'SELECT ''Column difficulty already exists in quizzes'''
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = @db_name
	  AND TABLE_NAME = 'quizzes'
	  AND COLUMN_NAME = 'question_count'
);
SET @query = IF(
	@col_exists = 0,
	'ALTER TABLE quizzes ADD COLUMN question_count INT DEFAULT 0 AFTER difficulty',
	'SELECT ''Column question_count already exists in quizzes'''
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add missing columns to flashcard_decks table (if missing)
SET @col_exists = (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = @db_name
	  AND TABLE_NAME = 'flashcard_decks'
	  AND COLUMN_NAME = 'name'
);
SET @query = IF(
	@col_exists = 0,
	'ALTER TABLE flashcard_decks ADD COLUMN name VARCHAR(255) NULL AFTER chapter_id',
	'SELECT ''Column name already exists in flashcard_decks'''
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = @db_name
	  AND TABLE_NAME = 'flashcard_decks'
	  AND COLUMN_NAME = 'card_count'
);
SET @query = IF(
	@col_exists = 0,
	'ALTER TABLE flashcard_decks ADD COLUMN card_count INT DEFAULT 0 AFTER language',
	'SELECT ''Column card_count already exists in flashcard_decks'''
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
