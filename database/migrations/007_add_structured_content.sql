-- =====================================================
-- Migration: Add structured_content to materials table
-- =====================================================

-- Add structured_content column to store AI-processed content
ALTER TABLE materials 
ADD COLUMN structured_content LONGTEXT NULL AFTER extracted_text;

-- Add processed_at timestamp to track when processing completed
ALTER TABLE materials 
ADD COLUMN processed_at DATETIME NULL AFTER structured_content;
