/**
 * Quiz Model
 * Database operations for quizzes, quiz_questions, and quiz_attempts tables
 */

const db = require('../config/database');
const { generateId } = require('../utils/helpers');

// =====================================================
// QUIZ OPERATIONS
// =====================================================

/**
 * Create a new quiz with questions
 * @param {Object} quizData
 * @returns {Promise<Object>}
 */
async function createQuiz({ chapterId, title, language, difficulty, questions }) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const quizId = generateId();
    
    // Create quiz
    await connection.query(
      `INSERT INTO quizzes (id, chapter_id, title, language, difficulty, question_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [quizId, chapterId, title, language, difficulty, questions.length]
    );
    
    // Create questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionId = generateId();
      
      await connection.query(
        `INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer_index, explanation, question_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [questionId, quizId, q.questionText, JSON.stringify(q.options), q.correctAnswerIndex, q.explanation, i]
      );
    }
    
    await connection.commit();
    
    return findQuizById(quizId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Find quiz by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findQuizById(id) {
  const [rows] = await db.query(
    `SELECT q.*, ch.title as chapter_title, ch.course_id
     FROM quizzes q
     JOIN chapters ch ON q.chapter_id = ch.id
     WHERE q.id = ?`,
    [id]
  );
  
  if (!rows[0]) return null;
  
  const quiz = formatQuiz(rows[0]);
  quiz.questions = await findQuestionsByQuiz(id);
  
  return quiz;
}

/**
 * Find quiz by ID without questions (for listing)
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findQuizByIdBasic(id) {
  const [rows] = await db.query(
    `SELECT q.*, ch.title as chapter_title, ch.course_id
     FROM quizzes q
     JOIN chapters ch ON q.chapter_id = ch.id
     WHERE q.id = ?`,
    [id]
  );
  return rows[0] ? formatQuiz(rows[0]) : null;
}

/**
 * Find all quizzes for a chapter
 * @param {string} chapterId
 * @param {string} language - Optional language filter
 * @returns {Promise<Array>}
 */
async function findQuizzesByChapter(chapterId, language = null) {
  let query = `
    SELECT q.*, ch.title as chapter_title, ch.course_id
    FROM quizzes q
    JOIN chapters ch ON q.chapter_id = ch.id
    WHERE q.chapter_id = ?`;
  
  const params = [chapterId];
  
  if (language) {
    query += ' AND q.language = ?';
    params.push(language);
  }
  
  query += ' ORDER BY q.created_at DESC';
  
  const [rows] = await db.query(query, params);
  return rows.map(formatQuiz);
}

/**
 * Find all quizzes for a course
 * @param {string} courseId
 * @returns {Promise<Array>}
 */
async function findQuizzesByCourse(courseId) {
  const [rows] = await db.query(
    `SELECT q.*, ch.title as chapter_title, ch.course_id
     FROM quizzes q
     JOIN chapters ch ON q.chapter_id = ch.id
     WHERE ch.course_id = ?
     ORDER BY ch.order_index ASC, q.created_at DESC`,
    [courseId]
  );
  return rows.map(formatQuiz);
}

/**
 * Delete a quiz (cascade deletes questions and attempts)
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function removeQuiz(id) {
  const [result] = await db.query(
    `DELETE FROM quizzes WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

// =====================================================
// QUIZ QUESTIONS OPERATIONS
// =====================================================

/**
 * Find all questions for a quiz
 * @param {string} quizId
 * @returns {Promise<Array>}
 */
async function findQuestionsByQuiz(quizId) {
  const [rows] = await db.query(
    `SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY question_order ASC`,
    [quizId]
  );
  return rows.map(formatQuestion);
}

/**
 * Find question by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findQuestionById(id) {
  const [rows] = await db.query(
    `SELECT * FROM quiz_questions WHERE id = ?`,
    [id]
  );
  return rows[0] ? formatQuestion(rows[0]) : null;
}

// =====================================================
// QUIZ ATTEMPTS OPERATIONS
// =====================================================

/**
 * Create a quiz attempt
 * @param {Object} attemptData
 * @returns {Promise<Object>}
 */
async function createAttempt({ quizId, userId, answers, score, passed, timeTakenSeconds }) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO quiz_attempts (id, quiz_id, user_id, answers, score, passed, time_taken_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, quizId, userId, JSON.stringify(answers), score, passed, timeTakenSeconds]
  );
  
  return findAttemptById(id);
}

/**
 * Find attempt by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findAttemptById(id) {
  const [rows] = await db.query(
    `SELECT a.*, q.title as quiz_title, q.chapter_id, ch.title as chapter_title
     FROM quiz_attempts a
     JOIN quizzes q ON a.quiz_id = q.id
     JOIN chapters ch ON q.chapter_id = ch.id
     WHERE a.id = ?`,
    [id]
  );
  return rows[0] ? formatAttempt(rows[0]) : null;
}

/**
 * Find all attempts for a quiz by a user
 * @param {string} quizId
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function findAttemptsByQuizAndUser(quizId, userId) {
  const [rows] = await db.query(
    `SELECT a.*, q.title as quiz_title, q.chapter_id, ch.title as chapter_title
     FROM quiz_attempts a
     JOIN quizzes q ON a.quiz_id = q.id
     JOIN chapters ch ON q.chapter_id = ch.id
     WHERE a.quiz_id = ? AND a.user_id = ?
     ORDER BY a.created_at DESC`,
    [quizId, userId]
  );
  return rows.map(formatAttempt);
}

/**
 * Find all attempts by a user
 * @param {string} userId
 * @param {Object} options - Optional filters { courseId, limit }
 * @returns {Promise<Array>}
 */
async function findAttemptsByUser(userId, options = {}) {
  let query = `
    SELECT a.*, q.title as quiz_title, q.chapter_id, ch.title as chapter_title, ch.course_id
    FROM quiz_attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    JOIN chapters ch ON q.chapter_id = ch.id
    WHERE a.user_id = ?`;
  
  const params = [userId];
  
  if (options.courseId) {
    query += ' AND ch.course_id = ?';
    params.push(options.courseId);
  }
  
  query += ' ORDER BY a.created_at DESC';
  
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  
  const [rows] = await db.query(query, params);
  return rows.map(formatAttempt);
}

/**
 * Get best attempt for a quiz by a user
 * @param {string} quizId
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function getBestAttempt(quizId, userId) {
  const [rows] = await db.query(
    `SELECT a.*, q.title as quiz_title, q.chapter_id, ch.title as chapter_title
     FROM quiz_attempts a
     JOIN quizzes q ON a.quiz_id = q.id
     JOIN chapters ch ON q.chapter_id = ch.id
     WHERE a.quiz_id = ? AND a.user_id = ?
     ORDER BY a.score DESC, a.time_taken_seconds ASC
     LIMIT 1`,
    [quizId, userId]
  );
  return rows[0] ? formatAttempt(rows[0]) : null;
}

/**
 * Get quiz statistics for a user
 * @param {string} userId
 * @param {string} courseId - Optional course filter
 * @returns {Promise<Object>}
 */
async function getUserQuizStats(userId, courseId = null) {
  let query = `
    SELECT 
      COUNT(DISTINCT a.quiz_id) as quizzes_taken,
      COUNT(a.id) as total_attempts,
      AVG(a.score) as average_score,
      SUM(CASE WHEN a.passed = 1 THEN 1 ELSE 0 END) as passed_count,
      SUM(a.time_taken_seconds) as total_time_seconds
    FROM quiz_attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    JOIN chapters ch ON q.chapter_id = ch.id
    WHERE a.user_id = ?`;
  
  const params = [userId];
  
  if (courseId) {
    query += ' AND ch.course_id = ?';
    params.push(courseId);
  }
  
  const [rows] = await db.query(query, params);
  
  return {
    quizzesTaken: rows[0].quizzes_taken || 0,
    totalAttempts: rows[0].total_attempts || 0,
    averageScore: parseFloat(rows[0].average_score) || 0,
    passedCount: rows[0].passed_count || 0,
    totalTimeSeconds: rows[0].total_time_seconds || 0,
  };
}

// =====================================================
// FORMAT FUNCTIONS
// =====================================================

/**
 * Format quiz object for API response
 * @param {Object} quiz
 * @returns {Object}
 */
function formatQuiz(quiz) {
  if (!quiz) return null;
  
  return {
    id: quiz.id,
    chapterId: quiz.chapter_id,
    chapterTitle: quiz.chapter_title,
    courseId: quiz.course_id,
    title: quiz.title,
    language: quiz.language,
    difficulty: quiz.difficulty,
    questionCount: quiz.question_count,
    createdAt: quiz.created_at,
    updatedAt: quiz.updated_at,
  };
}

/**
 * Format question object for API response
 * @param {Object} question
 * @returns {Object}
 */
function formatQuestion(question) {
  if (!question) return null;
  
  return {
    id: question.id,
    quizId: question.quiz_id,
    questionText: question.question_text,
    options: typeof question.options === 'string' ? JSON.parse(question.options) : question.options,
    correctAnswerIndex: question.correct_answer_index,
    explanation: question.explanation,
    questionOrder: question.question_order,
  };
}

/**
 * Format attempt object for API response
 * @param {Object} attempt
 * @returns {Object}
 */
function formatAttempt(attempt) {
  if (!attempt) return null;
  
  return {
    id: attempt.id,
    quizId: attempt.quiz_id,
    quizTitle: attempt.quiz_title,
    chapterId: attempt.chapter_id,
    chapterTitle: attempt.chapter_title,
    courseId: attempt.course_id,
    userId: attempt.user_id,
    answers: typeof attempt.answers === 'string' ? JSON.parse(attempt.answers) : attempt.answers,
    score: parseFloat(attempt.score),
    passed: !!attempt.passed,
    timeTakenSeconds: attempt.time_taken_seconds,
    createdAt: attempt.created_at,
  };
}

module.exports = {
  // Quiz
  createQuiz,
  findQuizById,
  findQuizByIdBasic,
  findQuizzesByChapter,
  findQuizzesByCourse,
  removeQuiz,
  formatQuiz,
  
  // Questions
  findQuestionsByQuiz,
  findQuestionById,
  formatQuestion,
  
  // Attempts
  createAttempt,
  findAttemptById,
  findAttemptsByQuizAndUser,
  findAttemptsByUser,
  getBestAttempt,
  getUserQuizStats,
  formatAttempt,
};
