/**
 * Quiz Service
 * Business logic for quizzes and quiz attempts
 */

const QuizModel = require('../models/quiz.model');
const ChapterModel = require('../models/chapter.model');
const MaterialModel = require('../models/material.model');
const aiService = require('./ai.service');
const streakService = require('./streak.service');
const logger = require('../config/logger');

// Default configuration
const DEFAULTS = {
  QUESTION_COUNT: 5,
  DIFFICULTY: 'medium',
  PASSING_SCORE: 70, // 70% to pass
};

/**
 * Get a quiz by ID
 * @param {string} quizId
 * @returns {Promise<Object|null>}
 */
async function getQuiz(quizId) {
  return QuizModel.findQuizById(quizId);
}

/**
 * Get all quizzes for a chapter
 * @param {string} chapterId
 * @param {string} language - Optional filter
 * @returns {Promise<Array>}
 */
async function getChapterQuizzes(chapterId, language = null) {
  return QuizModel.findQuizzesByChapter(chapterId, language);
}

/**
 * Get all quizzes for a course
 * @param {string} courseId
 * @returns {Promise<Array>}
 */
async function getCourseQuizzes(courseId) {
  return QuizModel.findQuizzesByCourse(courseId);
}

/**
 * Generate and save a quiz for a chapter
 * @param {string} chapterId
 * @param {string} userId
 * @param {Object} options - { language, difficulty, questionCount }
 * @returns {Promise<Object>}
 */
async function generateQuiz(chapterId, userId, options = {}) {
  // Get chapter with course info
  const chapter = await ChapterModel.findByIdWithCourse(chapterId);
  
  if (!chapter) {
    throw new Error('Chapter not found');
  }
  
  // Verify user owns the course
  if (chapter.course.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  // Get content from materials (structured content preferred, fallback to extracted text)
  const materials = await MaterialModel.findByChapter(chapterId);
  const completedMaterials = materials.filter(m => m.status === 'completed');
  
  if (completedMaterials.length === 0) {
    throw new Error('Chapter has no processed materials. Please upload and process materials first.');
  }
  
  // Combine content from all completed materials
  const contentParts = completedMaterials.map(m => {
    const content = m.structuredContent || m.extractedText;
    return content ? `## ${m.originalFilename}\n\n${content}` : '';
  }).filter(Boolean);
  
  if (contentParts.length === 0) {
    throw new Error('No content available from processed materials.');
  }
  
  const combinedContent = contentParts.join('\n\n---\n\n');
  
  const language = options.language || chapter.course.language || 'en';
  const difficulty = options.difficulty || DEFAULTS.DIFFICULTY;
  const questionCount = options.questionCount || DEFAULTS.QUESTION_COUNT;
  
  logger.info(`Generating ${questionCount} ${difficulty} quiz questions for chapter ${chapterId} in ${language}`);
  
  try {
    // Generate questions using AI
    const questions = await aiService.generateQuiz(
      combinedContent,
      language,
      difficulty,
      questionCount
    );
    
    // Create quiz title
    const title = `${chapter.title} - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Quiz`;
    
    // Save quiz with questions
    const quiz = await QuizModel.createQuiz({
      chapterId,
      title,
      language,
      difficulty,
      questions,
    });
    
    logger.info(`Quiz created for chapter ${chapterId}: ${quiz.id} with ${questions.length} questions`);
    
    return quiz;
  } catch (error) {
    logger.error(`Failed to generate quiz for chapter ${chapterId}:`, error.message);
    throw error;
  }
}

/**
 * Submit a quiz attempt
 * @param {string} quizId
 * @param {string} userId
 * @param {Array<number>} answers - Array of selected answer indices
 * @param {number} timeTakenSeconds - Time taken to complete quiz
 * @returns {Promise<Object>}
 */
async function submitAttempt(quizId, userId, answers, timeTakenSeconds = 0) {
  // Get quiz with questions
  const quiz = await QuizModel.findQuizById(quizId);
  
  if (!quiz) {
    throw new Error('Quiz not found');
  }
  
  if (!quiz.questions || quiz.questions.length === 0) {
    throw new Error('Quiz has no questions');
  }
  
  // Validate answers array
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    throw new Error(`Expected ${quiz.questions.length} answers, received ${answers?.length || 0}`);
  }
  
  // Score the quiz
  let correctCount = 0;
  const detailedAnswers = [];
  
  for (let i = 0; i < quiz.questions.length; i++) {
    const question = quiz.questions[i];
    const userAnswer = answers[i];
    const isCorrect = userAnswer === question.correctAnswerIndex;
    
    if (isCorrect) {
      correctCount++;
    }
    
    detailedAnswers.push({
      questionId: question.id,
      questionIndex: i,
      userAnswer,
      correctAnswer: question.correctAnswerIndex,
      isCorrect,
    });
  }
  
  // Calculate score as percentage
  const score = (correctCount / quiz.questions.length) * 100;
  const passed = score >= DEFAULTS.PASSING_SCORE;
  
  // Save attempt
  const attempt = await QuizModel.createAttempt({
    quizId,
    userId,
    answers: detailedAnswers,
    score,
    passed,
    timeTakenSeconds,
  });
  
  logger.info(`Quiz attempt recorded: ${attempt.id} - Score: ${score.toFixed(1)}% - ${passed ? 'PASSED' : 'FAILED'}`);
  
  // Log activity for streak tracking
  try {
    await streakService.logActivityAndUpdateStreak(userId, 'quiz', 'quiz', quizId);
    logger.info(`Activity logged for streak: quiz attempt by user ${userId}`);
  } catch (streakError) {
    // Don't fail the quiz submission if streak logging fails
    logger.warn(`Failed to log activity for streak: ${streakError.message}`);
  }
  
  // Add result details to response
  attempt.correctCount = correctCount;
  attempt.totalQuestions = quiz.questions.length;
  attempt.questionResults = detailedAnswers;
  
  return attempt;
}

/**
 * Get quiz attempt details with answers reviewed
 * @param {string} attemptId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getAttemptReview(attemptId, userId) {
  const attempt = await QuizModel.findAttemptById(attemptId);
  
  if (!attempt) {
    throw new Error('Attempt not found');
  }
  
  // Verify user owns this attempt
  if (attempt.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  // Get the full quiz with questions
  const quiz = await QuizModel.findQuizById(attempt.quizId);
  
  if (!quiz) {
    throw new Error('Quiz not found');
  }
  
  // Combine attempt answers with question details for review
  const review = {
    ...attempt,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      difficulty: quiz.difficulty,
    },
    questionReviews: quiz.questions.map((question, index) => {
      const userAnswerInfo = attempt.answers.find(a => a.questionIndex === index) || {};
      return {
        questionText: question.questionText,
        options: question.options,
        correctAnswerIndex: question.correctAnswerIndex,
        explanation: question.explanation,
        userAnswer: userAnswerInfo.userAnswer,
        isCorrect: userAnswerInfo.isCorrect,
      };
    }),
  };
  
  return review;
}

/**
 * Get user's quiz attempts
 * @param {string} userId
 * @param {Object} options - { courseId, limit }
 * @returns {Promise<Array>}
 */
async function getUserAttempts(userId, options = {}) {
  return QuizModel.findAttemptsByUser(userId, options);
}

/**
 * Get user's best attempt for a quiz
 * @param {string} quizId
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function getBestAttempt(quizId, userId) {
  return QuizModel.getBestAttempt(quizId, userId);
}

/**
 * Get user's quiz statistics
 * @param {string} userId
 * @param {string} courseId - Optional filter
 * @returns {Promise<Object>}
 */
async function getUserStats(userId, courseId = null) {
  return QuizModel.getUserQuizStats(userId, courseId);
}

/**
 * Delete a quiz
 * @param {string} quizId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function deleteQuiz(quizId, userId) {
  const quiz = await QuizModel.findQuizByIdBasic(quizId);
  
  if (!quiz) {
    throw new Error('Quiz not found');
  }
  
  // Verify user owns the chapter's course
  const chapter = await ChapterModel.findByIdWithCourse(quiz.chapterId);
  if (!chapter || chapter.course.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return QuizModel.removeQuiz(quizId);
}

module.exports = {
  getQuiz,
  getChapterQuizzes,
  getCourseQuizzes,
  generateQuiz,
  submitAttempt,
  getAttemptReview,
  getUserAttempts,
  getBestAttempt,
  getUserStats,
  deleteQuiz,
  DEFAULTS,
};
