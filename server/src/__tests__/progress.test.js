/**
 * Progress Service Tests
 * Unit tests for progress tracking calculations
 */

// Mock dependencies
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../../config/database');
const progressService = require('../../services/progress.service');

describe('Progress Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getChapterProgress', () => {
    const userId = 'user-123';
    const chapterId = 'chapter-123';

    it('should calculate 0% for new chapter with no progress', async () => {
      db.query.mockResolvedValueOnce([[{
        // Chapter exists but no user progress
        id: chapterId,
        has_materials: 0,
        has_summary: 0,
        has_quiz: 0,
        has_flashcards: 0,
      }]]);

      const result = await progressService.getChapterProgress(userId, chapterId);

      expect(result.progressPercent).toBe(0);
      expect(result.materialsProcessed).toBe(false);
      expect(result.summaryViewed).toBe(false);
      expect(result.quizPassed).toBe(false);
      expect(result.flashcardsReviewed).toBe(false);
    });

    it('should calculate 40% when only materials are processed', async () => {
      db.query.mockResolvedValueOnce([[{
        id: chapterId,
        has_materials: 1, // 40% weight
        has_summary: 0,
        has_quiz: 0,
        has_flashcards: 0,
      }]]);

      const result = await progressService.getChapterProgress(userId, chapterId);

      expect(result.progressPercent).toBe(40);
      expect(result.materialsProcessed).toBe(true);
    });

    it('should calculate 60% for materials + summary', async () => {
      db.query.mockResolvedValueOnce([[{
        id: chapterId,
        has_materials: 1, // 40%
        has_summary: 1,   // 20%
        has_quiz: 0,
        has_flashcards: 0,
      }]]);

      const result = await progressService.getChapterProgress(userId, chapterId);

      expect(result.progressPercent).toBe(60);
      expect(result.materialsProcessed).toBe(true);
      expect(result.summaryViewed).toBe(true);
    });

    it('should calculate 80% for materials + summary + quiz', async () => {
      db.query.mockResolvedValueOnce([[{
        id: chapterId,
        has_materials: 1, // 40%
        has_summary: 1,   // 20%
        has_quiz: 1,      // 20%
        has_flashcards: 0,
      }]]);

      const result = await progressService.getChapterProgress(userId, chapterId);

      expect(result.progressPercent).toBe(80);
      expect(result.quizPassed).toBe(true);
    });

    it('should calculate 100% when all activities completed', async () => {
      db.query.mockResolvedValueOnce([[{
        id: chapterId,
        has_materials: 1,   // 40%
        has_summary: 1,     // 20%
        has_quiz: 1,        // 20%
        has_flashcards: 1,  // 20%
      }]]);

      const result = await progressService.getChapterProgress(userId, chapterId);

      expect(result.progressPercent).toBe(100);
      expect(result.isComplete).toBe(true);
    });

    it('should return null for non-existent chapter', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const result = await progressService.getChapterProgress(userId, 'fake-chapter');

      expect(result).toBeNull();
    });
  });

  describe('getCourseProgress', () => {
    const userId = 'user-123';
    const courseId = 'course-123';

    it('should calculate course progress as average of chapter progress', async () => {
      db.query.mockResolvedValueOnce([[
        { chapter_id: 'ch1', progress: 100 },
        { chapter_id: 'ch2', progress: 50 },
        { chapter_id: 'ch3', progress: 0 },
      ]]);

      const result = await progressService.getCourseProgress(userId, courseId);

      // (100 + 50 + 0) / 3 = 50%
      expect(result.progressPercent).toBe(50);
      expect(result.completedChapters).toBe(1);
      expect(result.totalChapters).toBe(3);
    });

    it('should return 0% for course with no chapters', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const result = await progressService.getCourseProgress(userId, courseId);

      expect(result.progressPercent).toBe(0);
      expect(result.totalChapters).toBe(0);
    });

    it('should return 100% when all chapters are complete', async () => {
      db.query.mockResolvedValueOnce([[
        { chapter_id: 'ch1', progress: 100 },
        { chapter_id: 'ch2', progress: 100 },
      ]]);

      const result = await progressService.getCourseProgress(userId, courseId);

      expect(result.progressPercent).toBe(100);
      expect(result.isComplete).toBe(true);
      expect(result.completedChapters).toBe(2);
    });
  });

  describe('getUserProgress', () => {
    const userId = 'user-123';

    it('should aggregate progress across all courses', async () => {
      db.query.mockResolvedValueOnce([[
        { course_id: 'c1', progress: 100 },
        { course_id: 'c2', progress: 75 },
        { course_id: 'c3', progress: 25 },
      ]]);

      const result = await progressService.getUserProgress(userId);

      expect(result.totalCourses).toBe(3);
      expect(result.completedCourses).toBe(1);
      expect(result.averageProgress).toBe(Math.round((100 + 75 + 25) / 3));
    });

    it('should return empty stats for user with no courses', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const result = await progressService.getUserProgress(userId);

      expect(result.totalCourses).toBe(0);
      expect(result.completedCourses).toBe(0);
      expect(result.averageProgress).toBe(0);
    });
  });

  describe('getWeeklyActivitySummary', () => {
    const userId = 'user-123';

    it('should return activity counts by day', async () => {
      db.query.mockResolvedValueOnce([[
        { date: '2024-01-15', activity_type: 'quiz_completed', count: 3 },
        { date: '2024-01-15', activity_type: 'chapter_completed', count: 2 },
        { date: '2024-01-14', activity_type: 'quiz_completed', count: 1 },
      ]]);

      const result = await progressService.getWeeklyActivitySummary(userId);

      expect(result.byDay['2024-01-15'].total).toBe(5);
      expect(result.byDay['2024-01-15'].quizzes).toBe(3);
      expect(result.byDay['2024-01-15'].chapters).toBe(2);
    });

    it('should calculate weekly totals', async () => {
      db.query.mockResolvedValueOnce([[
        { date: '2024-01-15', activity_type: 'quiz_completed', count: 5 },
        { date: '2024-01-14', activity_type: 'quiz_completed', count: 3 },
        { date: '2024-01-13', activity_type: 'chapter_completed', count: 4 },
      ]]);

      const result = await progressService.getWeeklyActivitySummary(userId);

      expect(result.weeklyTotal).toBe(12);
      expect(result.totalQuizzes).toBe(8);
      expect(result.totalChapters).toBe(4);
    });

    it('should return zeros for inactive week', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const result = await progressService.getWeeklyActivitySummary(userId);

      expect(result.weeklyTotal).toBe(0);
      expect(result.activeDays).toBe(0);
    });
  });

  describe('getDashboardData', () => {
    const userId = 'user-123';

    it('should aggregate all dashboard data', async () => {
      // Mock all the queries for dashboard data
      db.query
        .mockResolvedValueOnce([[{ total: 5, completed: 2 }]]) // courses summary
        .mockResolvedValueOnce([[{ total: 25, completed: 15 }]]) // chapters summary
        .mockResolvedValueOnce([[{ total: 10, passed: 8, average_score: 82 }]]) // quiz stats
        .mockResolvedValueOnce([[{ current_streak: 7, longest_streak: 14 }]]) // streak
        .mockResolvedValueOnce([[ // recent activity
          { activity_type: 'quiz_completed', created_at: '2024-01-15' },
        ]])
        .mockResolvedValueOnce([[ // upcoming deadlines
          { title: 'Final Exam', due_date: '2024-01-20' },
        ]]);

      const result = await progressService.getDashboardData(userId);

      expect(result.stats.totalCourses).toBe(5);
      expect(result.stats.completedCourses).toBe(2);
      expect(result.stats.totalChapters).toBe(25);
      expect(result.stats.completedChapters).toBe(15);
      expect(result.stats.quizzesPassed).toBe(8);
      expect(result.stats.averageQuizScore).toBe(82);
      expect(result.streak.currentStreak).toBe(7);
      expect(result.recentActivity).toHaveLength(1);
      expect(result.upcomingDeadlines).toHaveLength(1);
    });
  });
});

describe('Progress Calculation Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle rounding in percentage calculations', async () => {
    db.query.mockResolvedValueOnce([[
      { chapter_id: 'ch1', progress: 33 },
      { chapter_id: 'ch2', progress: 33 },
      { chapter_id: 'ch3', progress: 34 },
    ]]);

    const result = await progressService.getCourseProgress('user', 'course');

    // Should round properly
    expect(result.progressPercent).toBe(33); // (33+33+34)/3 = 33.33...
  });

  it('should not exceed 100% progress', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 'chapter-id',
      has_materials: 1,
      has_summary: 1,
      has_quiz: 1,
      has_flashcards: 1,
    }]]);

    const result = await progressService.getChapterProgress('user', 'chapter');

    expect(result.progressPercent).toBeLessThanOrEqual(100);
  });

  it('should handle floating point precision', async () => {
    db.query.mockResolvedValueOnce([[
      { chapter_id: 'ch1', progress: 99.9 },
      { chapter_id: 'ch2', progress: 99.9 },
    ]]);

    const result = await progressService.getCourseProgress('user', 'course');

    // Should handle near-100% correctly
    expect(result.progressPercent).toBeLessThanOrEqual(100);
    expect(typeof result.progressPercent).toBe('number');
  });
});
