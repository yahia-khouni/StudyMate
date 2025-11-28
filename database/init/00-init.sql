-- Initial database setup
-- This file is automatically executed when the MySQL container is first created

-- Set character encoding
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Create database if not exists (redundant but safe)
CREATE DATABASE IF NOT EXISTS studyai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE studyai;

-- Grant privileges to application user
GRANT ALL PRIVILEGES ON studyai.* TO 'studyai'@'%';
FLUSH PRIVILEGES;
