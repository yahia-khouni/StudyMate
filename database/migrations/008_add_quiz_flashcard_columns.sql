-- =====================================================
-- Migration: Add missing columns to quizzes and flashcard_decks tables
-- =====================================================

-- Add missing columns to quizzes table
ALTER TABLE quizzes 
ADD COLUMN title VARCHAR(255) NULL AFTER chapter_id;

ALTER TABLE quizzes 
ADD COLUMN difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium' AFTER language;

ALTER TABLE quizzes 
ADD COLUMN question_count INT DEFAULT 0 AFTER difficulty;

-- Add missing columns to flashcard_decks table
ALTER TABLE flashcard_decks 
ADD COLUMN name VARCHAR(255) NULL AFTER chapter_id;

ALTER TABLE flashcard_decks 
ADD COLUMN card_count INT DEFAULT 0 AFTER language;
