/**
 * Quiz Service Tests
 * Unit tests for quiz grading logic
 */

// Mock dependencies
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../services/ai.service', () => ({
  generateQuiz: jest.fn(),
}));

jest.mock('../../services/streak.service', () => ({
  logActivityAndUpdateStreak: jest.fn().mockResolvedValue({}),
}));

const db = require('../../config/database');
const quizService = require('../../services/quiz.service');

describe('Quiz Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitAttempt', () => {
    const mockQuiz = {
      id: 'quiz-id',
      chapter_id: 'chapter-id',
      title: 'Test Quiz',
      language: 'en',
      difficulty: 'medium',
      questions: [
        {
          id: 'q1',
          question: 'What is 2 + 2?',
          options: ['3', '4', '5', '6'],
          correctAnswerIndex: 1, // Answer: 4
        },
        {
          id: 'q2',
          question: 'What is the capital of France?',
          options: ['London', 'Berlin', 'Paris', 'Madrid'],
          correctAnswerIndex: 2, // Answer: Paris
        },
        {
          id: 'q3',
          question: 'Which planet is closest to the sun?',
          options: ['Venus', 'Mercury', 'Mars', 'Earth'],
          correctAnswerIndex: 1, // Answer: Mercury
        },
        {
          id: 'q4',
          question: 'What year did WW2 end?',
          options: ['1944', '1945', '1946', '1947'],
          correctAnswerIndex: 1, // Answer: 1945
        },
        {
          id: 'q5',
          question: 'H2O is the chemical formula for?',
          options: ['Salt', 'Sugar', 'Water', 'Oxygen'],
          correctAnswerIndex: 2, // Answer: Water
        },
      ],
    };

    it('should score 100% for all correct answers', async () => {
      db.query.mockResolvedValueOnce([[mockQuiz]]);
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const correctAnswers = [1, 2, 1, 1, 2]; // All correct
      const result = await quizService.submitAttempt('quiz-id', 'user-id', correctAnswers);

      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.correctCount).toBe(5);
      expect(result.totalQuestions).toBe(5);
    });

    it('should score 0% for all wrong answers', async () => {
      db.query.mockResolvedValueOnce([[mockQuiz]]);
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const wrongAnswers = [0, 0, 0, 0, 0]; // All wrong
      const result = await quizService.submitAttempt('quiz-id', 'user-id', wrongAnswers);

      expect(result.score).toBe(0);
      expect(result.passed).toBe(false);
      expect(result.correctCount).toBe(0);
    });

    it('should calculate partial score correctly (60%)', async () => {
      db.query.mockResolvedValueOnce([[mockQuiz]]);
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const partialAnswers = [1, 2, 1, 0, 0]; // 3 out of 5 correct (60%)
      const result = await quizService.submitAttempt('quiz-id', 'user-id', partialAnswers);

      expect(result.score).toBe(60);
      expect(result.passed).toBe(false); // Below 70% threshold
      expect(result.correctCount).toBe(3);
    });

    it('should pass with exactly 70% score', async () => {
      // Create a quiz with 10 questions for easier 70% calculation
      const quiz10 = {
        ...mockQuiz,
        questions: [
          { id: 'q1', question: 'Q1', options: ['A', 'B'], correctAnswerIndex: 0 },
          { id: 'q2', question: 'Q2', options: ['A', 'B'], correctAnswerIndex: 0 },
          { id: 'q3', question: 'Q3', options: ['A', 'B'], correctAnswerIndex: 0 },
          { id: 'q4', question: 'Q4', options: ['A', 'B'], correctAnswerIndex: 0 },
          { id: 'q5', question: 'Q5', options: ['A', 'B'], correctAnswerIndex: 0 },
          { id: 'q6', question: 'Q6', options: ['A', 'B'], correctAnswerIndex: 0 },
          { id: 'q7', question: 'Q7', options: ['A', 'B'], correctAnswerIndex: 0 },
          { id: 'q8', question: 'Q8', options: ['A', 'B'], correctAnswerIndex: 0 },
          { id: 'q9', question: 'Q9', options: ['A', 'B'], correctAnswerIndex: 0 },
          { id: 'q10', question: 'Q10', options: ['A', 'B'], correctAnswerIndex: 0 },
        ],
      };

      db.query.mockResolvedValueOnce([[quiz10]]);
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);

      // 7 correct, 3 wrong = 70%
      const answers = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1];
      const result = await quizService.submitAttempt('quiz-id', 'user-id', answers);

      expect(result.score).toBe(70);
      expect(result.passed).toBe(true);
      expect(result.correctCount).toBe(7);
    });

    it('should fail with 69% score (just below threshold)', async () => {
      // Use the 10-question quiz
      const quiz10 = {
        ...mockQuiz,
        questions: Array(100).fill(null).map((_, i) => ({
          id: `q${i}`,
          question: `Question ${i}`,
          options: ['A', 'B'],
          correctAnswerIndex: 0,
        })),
      };

      db.query.mockResolvedValueOnce([[quiz10]]);
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);

      // 69 correct, 31 wrong = 69%
      const answers = Array(100).fill(0).map((_, i) => i < 69 ? 0 : 1);
      const result = await quizService.submitAttempt('quiz-id', 'user-id', answers);

      expect(result.score).toBe(69);
      expect(result.passed).toBe(false);
    });

    it('should throw error for non-existent quiz', async () => {
      db.query.mockResolvedValueOnce([[]]);

      await expect(quizService.submitAttempt('fake-quiz', 'user-id', [0, 0]))
        .rejects.toThrow('Quiz not found');
    });

    it('should throw error for wrong number of answers', async () => {
      db.query.mockResolvedValueOnce([[mockQuiz]]);

      // Quiz has 5 questions, providing only 3 answers
      await expect(quizService.submitAttempt('quiz-id', 'user-id', [0, 0, 0]))
        .rejects.toThrow('Expected 5 answers');
    });

    it('should track which answers were correct/incorrect', async () => {
      db.query.mockResolvedValueOnce([[mockQuiz]]);
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const mixedAnswers = [1, 0, 1, 0, 2]; // Correct, Wrong, Correct, Wrong, Correct
      const result = await quizService.submitAttempt('quiz-id', 'user-id', mixedAnswers);

      expect(result.questionResults).toHaveLength(5);
      expect(result.questionResults[0].isCorrect).toBe(true);
      expect(result.questionResults[1].isCorrect).toBe(false);
      expect(result.questionResults[2].isCorrect).toBe(true);
      expect(result.questionResults[3].isCorrect).toBe(false);
      expect(result.questionResults[4].isCorrect).toBe(true);
    });

    it('should store time taken', async () => {
      db.query.mockResolvedValueOnce([[mockQuiz]]);
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const answers = [1, 2, 1, 1, 2];
      await quizService.submitAttempt('quiz-id', 'user-id', answers, 120);

      // Check that the insert included time taken
      const insertCall = db.query.mock.calls[1];
      expect(insertCall[1]).toContain(120);
    });
  });

  describe('getQuiz', () => {
    it('should return quiz by ID', async () => {
      const mockQuiz = {
        id: 'quiz-id',
        title: 'Test Quiz',
        questions: [],
      };

      db.query.mockResolvedValueOnce([[mockQuiz]]);

      const result = await quizService.getQuiz('quiz-id');

      expect(result).toEqual(mockQuiz);
    });

    it('should return null for non-existent quiz', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const result = await quizService.getQuiz('fake-id');

      expect(result).toBeNull();
    });
  });
});

describe('Quiz Scoring Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle single question quiz', async () => {
    const singleQuestionQuiz = {
      id: 'quiz-id',
      title: 'Single Question Quiz',
      questions: [
        {
          id: 'q1',
          question: 'Yes or No?',
          options: ['Yes', 'No'],
          correctAnswerIndex: 0,
        },
      ],
    };

    db.query.mockResolvedValueOnce([[singleQuestionQuiz]]);
    db.query.mockResolvedValueOnce([{ insertId: 1 }]);

    const result = await quizService.submitAttempt('quiz-id', 'user-id', [0]);

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('should handle quiz with many questions', async () => {
    const largeQuiz = {
      id: 'quiz-id',
      title: 'Large Quiz',
      questions: Array(50).fill(null).map((_, i) => ({
        id: `q${i}`,
        question: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswerIndex: i % 4,
      })),
    };

    db.query.mockResolvedValueOnce([[largeQuiz]]);
    db.query.mockResolvedValueOnce([{ insertId: 1 }]);

    // Answer all correctly
    const answers = Array(50).fill(null).map((_, i) => i % 4);
    const result = await quizService.submitAttempt('quiz-id', 'user-id', answers);

    expect(result.score).toBe(100);
    expect(result.totalQuestions).toBe(50);
  });
});
