-- =====================================================
-- Manual Migration Script for Existing Databases
-- Run this if you already have 001_initial_schema applied
-- =====================================================
-- This script applies migrations 007 and 008

USE studyai;

-- =====================================================
-- Migration 007: Add structured_content to materials table
-- =====================================================

-- Check if column exists before adding
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'studyai' AND TABLE_NAME = 'materials' AND COLUMN_NAME = 'structured_content');
SET @query = IF(@col_exists = 0, 
    'ALTER TABLE materials ADD COLUMN structured_content LONGTEXT NULL AFTER extracted_text', 
    'SELECT "Column structured_content already exists"');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'studyai' AND TABLE_NAME = 'materials' AND COLUMN_NAME = 'processed_at');
SET @query = IF(@col_exists = 0, 
    'ALTER TABLE materials ADD COLUMN processed_at DATETIME NULL AFTER structured_content', 
    'SELECT "Column processed_at already exists"');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- Migration 008: Add missing columns to quizzes and flashcard_decks
-- =====================================================

-- Quizzes table
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'studyai' AND TABLE_NAME = 'quizzes' AND COLUMN_NAME = 'title');
SET @query = IF(@col_exists = 0, 
    'ALTER TABLE quizzes ADD COLUMN title VARCHAR(255) NULL AFTER chapter_id', 
    'SELECT "Column title already exists in quizzes"');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'studyai' AND TABLE_NAME = 'quizzes' AND COLUMN_NAME = 'difficulty');
SET @query = IF(@col_exists = 0, 
    'ALTER TABLE quizzes ADD COLUMN difficulty ENUM(''easy'', ''medium'', ''hard'') DEFAULT ''medium'' AFTER language', 
    'SELECT "Column difficulty already exists in quizzes"');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'studyai' AND TABLE_NAME = 'quizzes' AND COLUMN_NAME = 'question_count');
SET @query = IF(@col_exists = 0, 
    'ALTER TABLE quizzes ADD COLUMN question_count INT DEFAULT 0 AFTER difficulty', 
    'SELECT "Column question_count already exists in quizzes"');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Flashcard_decks table
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'studyai' AND TABLE_NAME = 'flashcard_decks' AND COLUMN_NAME = 'name');
SET @query = IF(@col_exists = 0, 
    'ALTER TABLE flashcard_decks ADD COLUMN name VARCHAR(255) NULL AFTER chapter_id', 
    'SELECT "Column name already exists in flashcard_decks"');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'studyai' AND TABLE_NAME = 'flashcard_decks' AND COLUMN_NAME = 'card_count');
SET @query = IF(@col_exists = 0, 
    'ALTER TABLE flashcard_decks ADD COLUMN card_count INT DEFAULT 0 AFTER language', 
    'SELECT "Column card_count already exists in flashcard_decks"');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migrations 007 and 008 applied successfully!' AS status;
