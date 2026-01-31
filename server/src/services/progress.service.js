/**
 * Progress Service
 * Business logic for tracking user learning progress and analytics
 */

const db = require('../config/database');
const logger = require('../config/logger');

/**
 * Get chapter progress details
 * @param {string} chapterId - Chapter ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Chapter progress
 */
async function getChapterProgress(chapterId, userId) {
  // Get chapter with course info
  const [chapterRows] = await db.query(
    `SELECT c.*, 
            co.user_id,
            co.name as course_name
     FROM chapters c
     JOIN courses co ON c.course_id = co.id
     WHERE c.id = ? AND co.user_id = ?`,
    [chapterId, userId]
  );

  if (!chapterRows[0]) {
    return null;
  }

  const chapter = chapterRows[0];

  // Get materials stats
  const [materialStats] = await db.query(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as processed,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
       SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM materials WHERE chapter_id = ?`,
    [chapterId]
  );

  // Get summary status
  const [summaryRows] = await db.query(
    `SELECT id, language FROM summaries WHERE chapter_id = ?`,
    [chapterId]
  );

  // Get quiz stats
  const [quizStats] = await db.query(
    `SELECT 
       COUNT(DISTINCT q.id) as total_quizzes,
       COUNT(DISTINCT qa.id) as total_attempts,
       AVG(qa.score) as avg_score,
       MAX(qa.score) as best_score
     FROM quizzes q
     LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.user_id = ?
     WHERE q.chapter_id = ?`,
    [userId, chapterId]
  );

  // Get flashcard stats
  const [flashcardStats] = await db.query(
    `SELECT 
       COUNT(DISTINCT fd.id) as total_decks,
       COUNT(DISTINCT fc.id) as total_cards,
       COUNT(DISTINCT fp.flashcard_id) as reviewed_cards,
       AVG(fp.ease_factor) as avg_ease
     FROM flashcard_decks fd
     LEFT JOIN flashcards fc ON fd.id = fc.deck_id
     LEFT JOIN flashcard_progress fp ON fc.id = fp.flashcard_id AND fp.user_id = ?
     WHERE fd.chapter_id = ?`,
    [userId, chapterId]
  );

  const materials = materialStats[0];
  const processedPercent = materials.total > 0 ? Math.round((materials.processed / materials.total) * 100) : 0;
  
  // Calculate overall chapter completion
  let completionFactors = 0;
  let completionScore = 0;

  // Materials processed (40% weight)
  if (materials.total > 0) {
    completionFactors += 40;
    completionScore += (materials.processed / materials.total) * 40;
  }

  // Summary generated (20% weight)
  if (materials.processed > 0) {
    completionFactors += 20;
    if (summaryRows.length > 0) {
      completionScore += 20;
    }
  }

  // Quiz attempted (20% weight)
  const quizData = quizStats[0];
  if (quizData.total_quizzes > 0) {
    completionFactors += 20;
    if (quizData.total_attempts > 0) {
      completionScore += 20;
    }
  }

  // Flashcards reviewed (20% weight)
  const flashData = flashcardStats[0];
  if (flashData.total_cards > 0) {
    completionFactors += 20;
    const reviewedPercent = flashData.reviewed_cards / flashData.total_cards;
    completionScore += reviewedPercent * 20;
  }

  const completedPercent = completionFactors > 0 ? Math.round((completionScore / completionFactors) * 100) : 0;

  return {
    chapterId,
    chapterTitle: chapter.title,
    courseId: chapter.course_id,
    courseName: chapter.course_name,
    status: chapter.status,
    materials: {
      total: materials.total || 0,
      processed: materials.processed || 0,
      pending: materials.pending || 0,
      processing: materials.processing || 0,
      failed: materials.failed || 0,
      processedPercent,
    },
    summary: {
      exists: summaryRows.length > 0,
      languages: summaryRows.map(s => s.language),
    },
    quizzes: {
      totalQuizzes: quizData.total_quizzes || 0,
      totalAttempts: quizData.total_attempts || 0,
      avgScore: quizData.avg_score ? Math.round(quizData.avg_score) : null,
      bestScore: quizData.best_score ? Math.round(quizData.best_score) : null,
    },
    flashcards: {
      totalDecks: flashData.total_decks || 0,
      totalCards: flashData.total_cards || 0,
      reviewedCards: flashData.reviewed_cards || 0,
      masteryPercent: flashData.total_cards > 0 
        ? Math.round((flashData.reviewed_cards / flashData.total_cards) * 100) 
        : 0,
    },
    completedPercent,
  };
}

/**
 * Get course progress aggregation
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Course progress
 */
async function getCourseProgress(courseId, userId) {
  // Verify ownership
  const [courseRows] = await db.query(
    `SELECT * FROM courses WHERE id = ? AND user_id = ?`,
    [courseId, userId]
  );

  if (!courseRows[0]) {
    return null;
  }

  const course = courseRows[0];

  // Get all chapters with aggregated stats
  const [chapters] = await db.query(
    `SELECT 
       c.id, c.title, c.status, c.order_index,
       (SELECT COUNT(*) FROM materials WHERE chapter_id = c.id) as material_count,
       (SELECT COUNT(*) FROM materials WHERE chapter_id = c.id AND status = 'completed') as processed_count,
       (SELECT COUNT(*) FROM summaries WHERE chapter_id = c.id) as summary_count,
       (SELECT COUNT(*) FROM quizzes WHERE chapter_id = c.id) as quiz_count,
       (SELECT COUNT(*) FROM flashcard_decks WHERE chapter_id = c.id) as deck_count
     FROM chapters c
     WHERE c.course_id = ?
     ORDER BY c.order_index`,
    [courseId]
  );

  // Get overall quiz stats for course
  const [quizStats] = await db.query(
    `SELECT 
       COUNT(DISTINCT q.id) as total_quizzes,
       COUNT(DISTINCT qa.id) as total_attempts,
       AVG(qa.score) as avg_score,
       SUM(CASE WHEN qa.passed = 1 THEN 1 ELSE 0 END) as passed_count
     FROM quizzes q
     JOIN chapters c ON q.chapter_id = c.id
     LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.user_id = ?
     WHERE c.course_id = ?`,
    [userId, courseId]
  );

  // Get flashcard mastery for course
  const [flashcardStats] = await db.query(
    `SELECT 
       COUNT(DISTINCT fc.id) as total_cards,
       COUNT(DISTINCT fp.flashcard_id) as reviewed_cards,
       SUM(CASE WHEN fp.repetitions >= 3 THEN 1 ELSE 0 END) as mastered_cards
     FROM flashcard_decks fd
     JOIN chapters c ON fd.chapter_id = c.id
     LEFT JOIN flashcards fc ON fd.id = fc.deck_id
     LEFT JOIN flashcard_progress fp ON fc.id = fp.flashcard_id AND fp.user_id = ?
     WHERE c.course_id = ?`,
    [userId, courseId]
  );

  // Calculate chapter-level progress
  const chapterProgress = chapters.map(ch => ({
    id: ch.id,
    title: ch.title,
    status: ch.status,
    orderIndex: ch.order_index,
    materialsUploaded: ch.material_count || 0,
    materialsProcessed: ch.processed_count || 0,
    hasSummary: ch.summary_count > 0,
    hasQuiz: ch.quiz_count > 0,
    hasFlashcards: ch.deck_count > 0,
    progressPercent: calculateChapterProgressPercent(ch),
  }));

  // Calculate overall course progress
  const totalChapters = chapters.length;
  const completedChapters = chapters.filter(ch => ch.status === 'completed').length;
  const overallProgress = totalChapters > 0 
    ? Math.round(chapterProgress.reduce((sum, ch) => sum + ch.progressPercent, 0) / totalChapters)
    : 0;

  const quizData = quizStats[0];
  const flashData = flashcardStats[0];

  return {
    courseId,
    courseName: course.name,
    language: course.language,
    color: course.color,
    chapters: {
      total: totalChapters,
      completed: completedChapters,
      details: chapterProgress,
    },
    quizzes: {
      total: quizData.total_quizzes || 0,
      attempted: quizData.total_attempts || 0,
      passed: quizData.passed_count || 0,
      avgScore: quizData.avg_score ? Math.round(quizData.avg_score) : null,
    },
    flashcards: {
      totalCards: flashData.total_cards || 0,
      reviewedCards: flashData.reviewed_cards || 0,
      masteredCards: flashData.mastered_cards || 0,
      masteryPercent: flashData.total_cards > 0
        ? Math.round((flashData.mastered_cards / flashData.total_cards) * 100)
        : 0,
    },
    overallProgress,
    updatedAt: course.updated_at,
  };
}

/**
 * Calculate chapter progress percent
 * @param {Object} chapter - Chapter data
 * @returns {number} Progress percent
 */
function calculateChapterProgressPercent(chapter) {
  let score = 0;
  let factors = 0;

  // Materials processed (40%)
  if (chapter.material_count > 0) {
    factors += 40;
    score += (chapter.processed_count / chapter.material_count) * 40;
  }

  // Summary generated (20%)
  if (chapter.processed_count > 0) {
    factors += 20;
    if (chapter.summary_count > 0) score += 20;
  }

  // Quiz exists (20%)
  if (chapter.processed_count > 0) {
    factors += 20;
    if (chapter.quiz_count > 0) score += 20;
  }

  // Flashcards exist (20%)
  if (chapter.processed_count > 0) {
    factors += 20;
    if (chapter.deck_count > 0) score += 20;
  }

  return factors > 0 ? Math.round((score / factors) * 100) : 0;
}

/**
 * Get user-wide progress summary
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User progress summary
 */
async function getUserProgress(userId) {
  // Get course stats
  const [courseStats] = await db.query(
    `SELECT 
       COUNT(*) as total_courses,
       (SELECT COUNT(*) FROM chapters WHERE course_id IN (SELECT id FROM courses WHERE user_id = ?)) as total_chapters,
       (SELECT COUNT(*) FROM chapters WHERE course_id IN (SELECT id FROM courses WHERE user_id = ?) AND status = 'completed') as completed_chapters
     FROM courses WHERE user_id = ?`,
    [userId, userId, userId]
  );

  // Get quiz stats
  const [quizStats] = await db.query(
    `SELECT 
       COUNT(*) as total_attempts,
       AVG(score) as avg_score,
       SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed_count,
       MAX(score) as best_score
     FROM quiz_attempts WHERE user_id = ?`,
    [userId]
  );

  // Get flashcard stats
  const [flashcardStats] = await db.query(
    `SELECT 
       COUNT(DISTINCT flashcard_id) as reviewed_cards,
       SUM(CASE WHEN repetitions >= 3 THEN 1 ELSE 0 END) as mastered_cards,
       SUM(repetitions) as total_reviews
     FROM flashcard_progress WHERE user_id = ?`,
    [userId]
  );

  // Get streak info
  const [streakData] = await db.query(
    `SELECT current_streak, longest_streak, last_activity_date
     FROM streaks WHERE user_id = ?`,
    [userId]
  );

  // Get materials stats
  const [materialStats] = await db.query(
    `SELECT 
       COUNT(*) as total_materials,
       SUM(file_size) as total_size
     FROM materials m
     JOIN chapters c ON m.chapter_id = c.id
     JOIN courses co ON c.course_id = co.id
     WHERE co.user_id = ?`,
    [userId]
  );

  const courses = courseStats[0];
  const quizzes = quizStats[0];
  const flashcards = flashcardStats[0];
  const streak = streakData[0] || { current_streak: 0, longest_streak: 0 };
  const materials = materialStats[0];

  return {
    courses: {
      total: courses.total_courses || 0,
      chapters: {
        total: courses.total_chapters || 0,
        completed: courses.completed_chapters || 0,
      },
    },
    quizzes: {
      totalAttempts: quizzes.total_attempts || 0,
      avgScore: quizzes.avg_score ? Math.round(quizzes.avg_score) : null,
      passedCount: quizzes.passed_count || 0,
      bestScore: quizzes.best_score ? Math.round(quizzes.best_score) : null,
    },
    flashcards: {
      reviewedCards: flashcards.reviewed_cards || 0,
      masteredCards: flashcards.mastered_cards || 0,
      totalReviews: flashcards.total_reviews || 0,
    },
    streak: {
      current: streak.current_streak || 0,
      longest: streak.longest_streak || 0,
      lastActivity: streak.last_activity_date,
    },
    materials: {
      total: materials.total_materials || 0,
      totalSizeMB: materials.total_size 
        ? Math.round(materials.total_size / (1024 * 1024) * 10) / 10 
        : 0,
    },
  };
}

/**
 * Get weekly activity summary (last 7 days)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Weekly activity summary
 */
async function getWeeklyActivitySummary(userId) {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const startDate = sevenDaysAgo.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  // Get daily activity counts
  const [dailyActivity] = await db.query(
    `SELECT 
       activity_date,
       activity_type,
       COUNT(*) as count
     FROM activity_log
     WHERE user_id = ? AND activity_date BETWEEN ? AND ?
     GROUP BY activity_date, activity_type
     ORDER BY activity_date`,
    [userId, startDate, endDate]
  );

  // Get recent activity items with details
  const [recentItems] = await db.query(
    `SELECT 
       al.id,
       al.activity_type,
       al.entity_type,
       al.entity_id,
       al.activity_date,
       al.created_at
     FROM activity_log al
     WHERE al.user_id = ? AND al.activity_date BETWEEN ? AND ?
     ORDER BY al.created_at DESC
     LIMIT 20`,
    [userId, startDate, endDate]
  );

  // Build daily breakdown
  const dailyBreakdown = {};
  for (let d = new Date(sevenDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dailyBreakdown[dateStr] = {
      date: dateStr,
      upload: 0,
      quiz: 0,
      flashcard_review: 0,
      chat: 0,
      total: 0,
    };
  }

  // Fill in actual data
  for (const row of dailyActivity) {
    const dateStr = row.activity_date instanceof Date 
      ? row.activity_date.toISOString().split('T')[0]
      : row.activity_date;
    if (dailyBreakdown[dateStr]) {
      dailyBreakdown[dateStr][row.activity_type] = row.count;
      dailyBreakdown[dateStr].total += row.count;
    }
  }

  // Calculate totals
  const totals = {
    upload: 0,
    quiz: 0,
    flashcard_review: 0,
    chat: 0,
    total: 0,
  };

  Object.values(dailyBreakdown).forEach(day => {
    totals.upload += day.upload;
    totals.quiz += day.quiz;
    totals.flashcard_review += day.flashcard_review;
    totals.chat += day.chat;
    totals.total += day.total;
  });

  // Days with activity
  const activeDays = Object.values(dailyBreakdown).filter(d => d.total > 0).length;

  return {
    period: {
      start: startDate,
      end: endDate,
      days: 7,
    },
    summary: {
      totalActivities: totals.total,
      activeDays,
      avgActivitiesPerDay: Math.round((totals.total / 7) * 10) / 10,
      byType: {
        uploads: totals.upload,
        quizzes: totals.quiz,
        flashcardReviews: totals.flashcard_review,
        chats: totals.chat,
      },
    },
    dailyBreakdown: Object.values(dailyBreakdown),
    recentActivity: recentItems.map(item => ({
      id: item.id,
      type: item.activity_type,
      entityType: item.entity_type,
      entityId: item.entity_id,
      date: item.activity_date,
      timestamp: item.created_at,
    })),
  };
}

/**
 * Get dashboard data (aggregated for dashboard page)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Dashboard data
 */
async function getDashboardData(userId) {
  // Get courses with progress
  const [courses] = await db.query(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM chapters WHERE course_id = c.id) as chapter_count,
            (SELECT COUNT(*) FROM chapters WHERE course_id = c.id AND status = 'completed') as completed_chapters
     FROM courses c
     WHERE c.user_id = ?
     ORDER BY c.updated_at DESC
     LIMIT 6`,
    [userId]
  );

  // Get upcoming deadlines (calendar events)
  const [upcomingDeadlines] = await db.query(
    `SELECT id, title, event_type, start_date, end_date, course_id
     FROM calendar_events
     WHERE user_id = ? 
       AND event_type IN ('deadline', 'exam')
       AND start_date >= CURDATE()
     ORDER BY start_date
     LIMIT 5`,
    [userId]
  );

  // Get user progress summary
  const userProgress = await getUserProgress(userId);

  // Get weekly activity
  const weeklyActivity = await getWeeklyActivitySummary(userId);

  // Format courses with progress
  const coursesWithProgress = courses.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    color: c.color,
    language: c.language,
    chapterCount: c.chapter_count || 0,
    completedChapters: c.completed_chapters || 0,
    progress: c.chapter_count > 0 
      ? Math.round((c.completed_chapters / c.chapter_count) * 100)
      : 0,
    updatedAt: c.updated_at,
  }));

  return {
    courses: coursesWithProgress,
    upcomingDeadlines: upcomingDeadlines.map(d => ({
      id: d.id,
      title: d.title,
      type: d.event_type,
      date: d.start_date,
      endDate: d.end_date,
      courseId: d.course_id,
    })),
    stats: userProgress,
    weeklyActivity: weeklyActivity.summary,
    recentActivity: weeklyActivity.recentActivity.slice(0, 10),
  };
}

module.exports = {
  getChapterProgress,
  getCourseProgress,
  getUserProgress,
  getWeeklyActivitySummary,
  getDashboardData,
};
