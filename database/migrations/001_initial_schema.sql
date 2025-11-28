-- =====================================================
-- StudyAI Database Schema
-- Migration: 001_initial_schema
-- =====================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL, -- NULL for OAuth-only users
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500) NULL,
    
    -- OAuth
    google_id VARCHAR(255) NULL UNIQUE,
    
    -- Email verification
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255) NULL,
    email_verification_expires DATETIME NULL,
    
    -- Password reset
    password_reset_token VARCHAR(255) NULL,
    password_reset_expires DATETIME NULL,
    
    -- Preferences
    language_preference ENUM('en', 'fr') DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL,
    
    INDEX idx_users_email (email),
    INDEX idx_users_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_refresh_tokens_user (user_id),
    INDEX idx_refresh_tokens_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- COURSES & CHAPTERS
-- =====================================================

CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    syllabus TEXT NULL,
    language ENUM('en', 'fr') DEFAULT 'en',
    color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for UI
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_courses_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chapters (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    order_index INT NOT NULL DEFAULT 0,
    
    -- Status: draft -> processing -> ready -> completed
    status ENUM('draft', 'processing', 'ready', 'completed') DEFAULT 'draft',
    
    -- Processed content (extracted and structured by AI)
    processed_content LONGTEXT NULL,
    processed_at DATETIME NULL,
    
    -- Completion tracking
    completed_at DATETIME NULL,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    INDEX idx_chapters_course (course_id),
    INDEX idx_chapters_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- MATERIALS (Uploaded Files)
-- =====================================================

CREATE TABLE IF NOT EXISTS materials (
    id VARCHAR(36) PRIMARY KEY,
    chapter_id VARCHAR(36) NOT NULL,
    
    -- File info
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL, -- bytes
    mime_type VARCHAR(100) NOT NULL,
    
    -- Processing status
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    processing_error TEXT NULL,
    
    -- Extracted content (raw text before AI processing)
    extracted_text LONGTEXT NULL,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    INDEX idx_materials_chapter (chapter_id),
    INDEX idx_materials_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- AI-GENERATED CONTENT
-- =====================================================

-- Summaries
CREATE TABLE IF NOT EXISTS summaries (
    id VARCHAR(36) PRIMARY KEY,
    chapter_id VARCHAR(36) NOT NULL,
    language ENUM('en', 'fr') NOT NULL,
    content LONGTEXT NOT NULL, -- Markdown formatted
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    UNIQUE KEY unique_chapter_language (chapter_id, language),
    INDEX idx_summaries_chapter (chapter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
    id VARCHAR(36) PRIMARY KEY,
    chapter_id VARCHAR(36) NOT NULL,
    language ENUM('en', 'fr') NOT NULL,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    UNIQUE KEY unique_quiz_chapter_language (chapter_id, language),
    INDEX idx_quizzes_chapter (chapter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_questions (
    id VARCHAR(36) PRIMARY KEY,
    quiz_id VARCHAR(36) NOT NULL,
    question_text TEXT NOT NULL,
    question_order INT NOT NULL DEFAULT 0,
    
    -- Options (JSON array of strings)
    options JSON NOT NULL,
    
    -- Correct answer index (0-based)
    correct_answer_index INT NOT NULL,
    
    -- Explanation shown after answering
    explanation TEXT NULL,
    
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    INDEX idx_quiz_questions_quiz (quiz_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id VARCHAR(36) PRIMARY KEY,
    quiz_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    
    -- Answers (JSON: { questionId: selectedIndex })
    answers JSON NOT NULL,
    
    -- Results
    score DECIMAL(5,2) NOT NULL, -- Percentage (0-100)
    passed BOOLEAN NOT NULL, -- score >= 80%
    
    -- Timestamps
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_quiz_attempts_quiz (quiz_id),
    INDEX idx_quiz_attempts_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flashcards
CREATE TABLE IF NOT EXISTS flashcard_decks (
    id VARCHAR(36) PRIMARY KEY,
    chapter_id VARCHAR(36) NOT NULL,
    language ENUM('en', 'fr') NOT NULL,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    UNIQUE KEY unique_deck_chapter_language (chapter_id, language),
    INDEX idx_flashcard_decks_chapter (chapter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flashcards (
    id VARCHAR(36) PRIMARY KEY,
    deck_id VARCHAR(36) NOT NULL,
    front_content TEXT NOT NULL,
    back_content TEXT NOT NULL,
    card_order INT NOT NULL DEFAULT 0,
    
    FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    INDEX idx_flashcards_deck (deck_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flashcard review progress (spaced repetition)
CREATE TABLE IF NOT EXISTS flashcard_progress (
    id VARCHAR(36) PRIMARY KEY,
    flashcard_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    
    -- Spaced repetition data
    ease_factor DECIMAL(4,2) DEFAULT 2.50, -- SM-2 algorithm
    interval_days INT DEFAULT 1,
    repetitions INT DEFAULT 0,
    next_review_date DATE NULL,
    
    -- Status
    status ENUM('learning', 'known') DEFAULT 'learning',
    
    -- Timestamps
    last_reviewed_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_flashcard_user (flashcard_id, user_id),
    INDEX idx_flashcard_progress_user (user_id),
    INDEX idx_flashcard_progress_next_review (next_review_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- RAG CHAT HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NULL, -- Auto-generated from first message
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_chat_sessions_course (course_id),
    INDEX idx_chat_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,
    
    -- For assistant messages, store the sources used
    sources JSON NULL, -- Array of { chapterId, chapterTitle, excerpt }
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    INDEX idx_chat_messages_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CALENDAR & EVENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS calendar_events (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    course_id VARCHAR(36) NULL, -- Optional link to course
    
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    event_type ENUM('study', 'deadline', 'exam', 'other') NOT NULL,
    
    -- Timing
    start_date DATETIME NOT NULL,
    end_date DATETIME NULL,
    all_day BOOLEAN DEFAULT FALSE,
    
    -- Recurrence (iCal RRULE format, NULL for non-recurring)
    recurrence_rule VARCHAR(255) NULL,
    
    -- Reminders
    reminder_minutes INT NULL, -- Minutes before event to send reminder
    reminder_sent BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    INDEX idx_calendar_events_user (user_id),
    INDEX idx_calendar_events_date (start_date),
    INDEX idx_calendar_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- STREAKS & ACTIVITY TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS streaks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    
    -- Current streak
    current_streak INT DEFAULT 0,
    current_streak_start DATE NULL,
    
    -- Longest streak
    longest_streak INT DEFAULT 0,
    longest_streak_start DATE NULL,
    longest_streak_end DATE NULL,
    
    -- Last activity (in user's timezone)
    last_activity_date DATE NULL,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_streaks_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    
    -- Activity type
    activity_type ENUM('upload', 'flashcard_review', 'quiz', 'chat') NOT NULL,
    
    -- Related entity
    entity_type ENUM('chapter', 'flashcard', 'quiz', 'chat_session') NULL,
    entity_id VARCHAR(36) NULL,
    
    -- Activity date (in user's timezone)
    activity_date DATE NOT NULL,
    
    -- Timestamp
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_activity_log_user (user_id),
    INDEX idx_activity_log_date (activity_date),
    INDEX idx_activity_log_type (activity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    
    -- Notification content
    type ENUM('processing_complete', 'deadline_reminder', 'quiz_passed', 'streak_reminder', 'badge_earned') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Link to related entity
    link_url VARCHAR(500) NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    
    -- Email notification
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at DATETIME NULL,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user (user_id),
    INDEX idx_notifications_read (is_read),
    INDEX idx_notifications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- JOB QUEUE METADATA (for tracking BullMQ jobs)
-- =====================================================

CREATE TABLE IF NOT EXISTS job_metadata (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(255) NOT NULL, -- BullMQ job ID
    job_type ENUM('document_processing', 'summary_generation', 'quiz_generation', 'flashcard_generation', 'embedding_generation') NOT NULL,
    
    -- Related entity
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    
    -- Status tracking
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    progress INT DEFAULT 0, -- 0-100
    error_message TEXT NULL,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    
    INDEX idx_job_metadata_job (job_id),
    INDEX idx_job_metadata_entity (entity_type, entity_id),
    INDEX idx_job_metadata_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
