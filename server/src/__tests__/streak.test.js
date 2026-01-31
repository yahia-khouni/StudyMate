/**
 * Streak Service Tests
 * Unit tests for streak calculation and activity logging
 */

// Mock dependencies
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../../config/database');
const streakService = require('../../services/streak.service');

describe('Streak Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('logActivityAndUpdateStreak', () => {
    const userId = 'user-123';

    it('should start a new streak on first activity', async () => {
      // Mock: No existing streak
      db.query.mockResolvedValueOnce([[]]); // Get current streak
      db.query.mockResolvedValueOnce([{}]); // Insert activity
      db.query.mockResolvedValueOnce([{}]); // Insert new streak

      const result = await streakService.logActivityAndUpdateStreak(userId, 'quiz_completed', {
        quizId: 'quiz-1',
        score: 85,
      });

      expect(result.currentStreak).toBe(1);
      expect(result.isNewStreak).toBe(true);
    });

    it('should increment streak when continuing on consecutive day', async () => {
      // Set current date to Monday
      jest.setSystemTime(new Date('2024-01-15'));

      // Mock: Existing streak from yesterday (Sunday)
      db.query.mockResolvedValueOnce([[{
        current_streak: 5,
        longest_streak: 10,
        last_activity_date: '2024-01-14', // Yesterday
      }]]);
      db.query.mockResolvedValueOnce([{}]); // Insert activity
      db.query.mockResolvedValueOnce([{}]); // Update streak

      const result = await streakService.logActivityAndUpdateStreak(userId, 'chapter_completed', {
        chapterId: 'chapter-1',
      });

      expect(result.currentStreak).toBe(6);
      expect(result.streakIncremented).toBe(true);
    });

    it('should maintain streak for same day activity', async () => {
      jest.setSystemTime(new Date('2024-01-15'));

      // Mock: Activity already logged today
      db.query.mockResolvedValueOnce([[{
        current_streak: 5,
        longest_streak: 10,
        last_activity_date: '2024-01-15', // Same day
      }]]);
      db.query.mockResolvedValueOnce([{}]); // Insert activity

      const result = await streakService.logActivityAndUpdateStreak(userId, 'summary_viewed', {
        chapterId: 'chapter-1',
      });

      expect(result.currentStreak).toBe(5);
      expect(result.streakIncremented).toBe(false);
    });

    it('should reset streak when a day is missed', async () => {
      jest.setSystemTime(new Date('2024-01-17'));

      // Mock: Last activity was 2 days ago (missed a day)
      db.query.mockResolvedValueOnce([[{
        current_streak: 15,
        longest_streak: 20,
        last_activity_date: '2024-01-15', // 2 days ago
      }]]);
      db.query.mockResolvedValueOnce([{}]); // Insert activity
      db.query.mockResolvedValueOnce([{}]); // Update streak

      const result = await streakService.logActivityAndUpdateStreak(userId, 'flashcards_reviewed', {
        deckId: 'deck-1',
        cardsReviewed: 10,
      });

      expect(result.currentStreak).toBe(1);
      expect(result.streakReset).toBe(true);
    });

    it('should update longest streak when current exceeds it', async () => {
      jest.setSystemTime(new Date('2024-01-15'));

      // Mock: Current streak about to exceed longest
      db.query.mockResolvedValueOnce([[{
        current_streak: 10,
        longest_streak: 10,
        last_activity_date: '2024-01-14',
      }]]);
      db.query.mockResolvedValueOnce([{}]); // Insert activity
      db.query.mockResolvedValueOnce([{}]); // Update streak

      const result = await streakService.logActivityAndUpdateStreak(userId, 'quiz_completed', {
        quizId: 'quiz-1',
        score: 90,
      });

      expect(result.currentStreak).toBe(11);
      expect(result.longestStreak).toBe(11);
      expect(result.newRecord).toBe(true);
    });

    it('should log different activity types correctly', async () => {
      const activityTypes = [
        'quiz_completed',
        'chapter_completed',
        'summary_viewed',
        'flashcards_reviewed',
        'course_started',
        'material_processed',
      ];

      for (const activityType of activityTypes) {
        jest.clearAllMocks();
        
        db.query.mockResolvedValueOnce([[{
          current_streak: 1,
          longest_streak: 5,
          last_activity_date: new Date().toISOString().split('T')[0],
        }]]);
        db.query.mockResolvedValueOnce([{}]);

        await streakService.logActivityAndUpdateStreak(userId, activityType, {});

        // Verify activity was logged with correct type
        const insertCall = db.query.mock.calls[1];
        expect(insertCall[1]).toContain(activityType);
      }
    });
  });

  describe('getUserStreak', () => {
    it('should return current streak data', async () => {
      db.query.mockResolvedValueOnce([[{
        current_streak: 7,
        longest_streak: 14,
        last_activity_date: '2024-01-15',
      }]]);

      const result = await streakService.getUserStreak('user-123');

      expect(result.currentStreak).toBe(7);
      expect(result.longestStreak).toBe(14);
    });

    it('should return zero streak for new user', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const result = await streakService.getUserStreak('new-user');

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });

    it('should return zero if streak is broken (checked today)', async () => {
      jest.setSystemTime(new Date('2024-01-20'));

      db.query.mockResolvedValueOnce([[{
        current_streak: 10,
        longest_streak: 15,
        last_activity_date: '2024-01-17', // 3 days ago
      }]]);

      const result = await streakService.getUserStreak('user-123');

      expect(result.currentStreak).toBe(0);
      expect(result.isBroken).toBe(true);
    });
  });

  describe('getWeeklyActivity', () => {
    it('should return activity count for each day of the week', async () => {
      db.query.mockResolvedValueOnce([[
        { date: '2024-01-15', count: 3 },
        { date: '2024-01-14', count: 5 },
        { date: '2024-01-12', count: 2 },
      ]]);

      const result = await streakService.getWeeklyActivity('user-123');

      expect(result).toHaveLength(7);
      expect(result.find(d => d.date === '2024-01-15')?.count).toBe(3);
      expect(result.find(d => d.date === '2024-01-14')?.count).toBe(5);
      expect(result.find(d => d.date === '2024-01-13')?.count).toBe(0); // No activity
    });

    it('should return empty array for user with no activity', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const result = await streakService.getWeeklyActivity('user-123');

      expect(result).toHaveLength(7);
      result.forEach(day => {
        expect(day.count).toBe(0);
      });
    });
  });

  describe('getActivityHistory', () => {
    it('should return paginated activity history', async () => {
      const mockActivities = [
        { id: 1, activity_type: 'quiz_completed', created_at: '2024-01-15', metadata: '{}' },
        { id: 2, activity_type: 'chapter_completed', created_at: '2024-01-14', metadata: '{}' },
      ];

      db.query.mockResolvedValueOnce([mockActivities]);

      const result = await streakService.getActivityHistory('user-123', 10, 0);

      expect(result).toHaveLength(2);
      expect(result[0].activityType).toBe('quiz_completed');
    });

    it('should respect pagination limit and offset', async () => {
      db.query.mockResolvedValueOnce([[]]);

      await streakService.getActivityHistory('user-123', 5, 10);

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[1]).toContain(5); // limit
      expect(queryCall[1]).toContain(10); // offset
    });
  });
});

describe('Streak Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should handle timezone edge case at midnight', async () => {
    // Just before midnight
    jest.setSystemTime(new Date('2024-01-15T23:59:59Z'));

    db.query.mockResolvedValueOnce([[{
      current_streak: 5,
      longest_streak: 10,
      last_activity_date: '2024-01-14',
    }]]);
    db.query.mockResolvedValueOnce([{}]);
    db.query.mockResolvedValueOnce([{}]);

    const result = await streakService.logActivityAndUpdateStreak('user-123', 'quiz_completed', {});

    expect(result.currentStreak).toBe(6);
  });

  it('should handle first day of month correctly', async () => {
    jest.setSystemTime(new Date('2024-02-01'));

    db.query.mockResolvedValueOnce([[{
      current_streak: 31,
      longest_streak: 31,
      last_activity_date: '2024-01-31',
    }]]);
    db.query.mockResolvedValueOnce([{}]);
    db.query.mockResolvedValueOnce([{}]);

    const result = await streakService.logActivityAndUpdateStreak('user-123', 'quiz_completed', {});

    expect(result.currentStreak).toBe(32);
  });

  it('should handle leap year February 29', async () => {
    jest.setSystemTime(new Date('2024-03-01')); // Day after Feb 29

    db.query.mockResolvedValueOnce([[{
      current_streak: 29,
      longest_streak: 29,
      last_activity_date: '2024-02-29',
    }]]);
    db.query.mockResolvedValueOnce([{}]);
    db.query.mockResolvedValueOnce([{}]);

    const result = await streakService.logActivityAndUpdateStreak('user-123', 'quiz_completed', {});

    expect(result.currentStreak).toBe(30);
  });

  it('should handle very long streaks (365+ days)', async () => {
    jest.setSystemTime(new Date('2025-01-01'));

    db.query.mockResolvedValueOnce([[{
      current_streak: 365,
      longest_streak: 365,
      last_activity_date: '2024-12-31',
    }]]);
    db.query.mockResolvedValueOnce([{}]);
    db.query.mockResolvedValueOnce([{}]);

    const result = await streakService.logActivityAndUpdateStreak('user-123', 'quiz_completed', {});

    expect(result.currentStreak).toBe(366);
    expect(result.longestStreak).toBe(366);
  });

  it('should handle concurrent activity logging', async () => {
    // Simulate rapid consecutive calls
    const mockStreak = {
      current_streak: 5,
      longest_streak: 10,
      last_activity_date: new Date().toISOString().split('T')[0],
    };

    // Multiple calls should all succeed without incrementing streak multiple times
    db.query.mockResolvedValue([[mockStreak]]);
    db.query.mockResolvedValueOnce([{}]);
    db.query.mockResolvedValueOnce([{}]);

    const results = await Promise.all([
      streakService.logActivityAndUpdateStreak('user-123', 'quiz_completed', {}),
      streakService.logActivityAndUpdateStreak('user-123', 'chapter_completed', {}),
    ]);

    // Both should return same streak count (not double-incremented)
    expect(results[0].currentStreak).toBe(5);
    expect(results[1].currentStreak).toBe(5);
  });
});
