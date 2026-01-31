/**
 * Jest Test Setup
 * Global setup for all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Mock logger to reduce noise during tests
jest.mock('../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Global test utilities
global.testUtils = {
  /**
   * Generate a mock user object
   */
  mockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    languagePreference: 'en',
    createdAt: new Date(),
    ...overrides,
  }),

  /**
   * Generate a mock course object
   */
  mockCourse: (overrides = {}) => ({
    id: 'test-course-id',
    userId: 'test-user-id',
    name: 'Test Course',
    description: 'A test course',
    language: 'en',
    color: '#6366f1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Generate a mock chapter object
   */
  mockChapter: (overrides = {}) => ({
    id: 'test-chapter-id',
    courseId: 'test-course-id',
    title: 'Test Chapter',
    orderIndex: 0,
    status: 'ready',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Generate a mock quiz object
   */
  mockQuiz: (overrides = {}) => ({
    id: 'test-quiz-id',
    chapterId: 'test-chapter-id',
    title: 'Test Quiz',
    language: 'en',
    difficulty: 'medium',
    questions: [
      {
        id: 'q1',
        question: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        correctAnswerIndex: 1,
      },
      {
        id: 'q2',
        question: 'What is the capital of France?',
        options: ['London', 'Berlin', 'Paris', 'Madrid'],
        correctAnswerIndex: 2,
      },
    ],
    createdAt: new Date(),
    ...overrides,
  }),

  /**
   * Wait for a specified time
   */
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Increase timeout for integration tests
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Add any global cleanup here
});
