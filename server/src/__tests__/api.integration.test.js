/**
 * API Integration Tests
 * Tests for HTTP endpoints using Supertest
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock database before importing app
jest.mock('../../config/database', () => ({
  query: jest.fn(),
  getConnection: jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
  }),
}));

jest.mock('../../services/ai.service', () => ({
  generateQuiz: jest.fn(),
  generateSummary: jest.fn(),
  generateFlashcards: jest.fn(),
  chatWithAI: jest.fn(),
}));

jest.mock('../../services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({}),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({}),
}));

// Create a minimal express app for testing
const express = require('express');
const db = require('../../config/database');

// Helper to create test JWT token
const createTestToken = (userId = 'test-user-id', email = 'test@example.com') => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );
};

describe('Auth API', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', require('../../routes/auth.routes'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      db.query
        .mockResolvedValueOnce([[]]) // Check existing user - none found
        .mockResolvedValueOnce([{ insertId: 1 }]); // Insert user

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'newuser@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('registered');
    });

    it('should reject registration with existing email', async () => {
      db.query.mockResolvedValueOnce([[{ id: 'existing-user' }]]);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'existing@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(409);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          // Missing name and password
        });

      expect(response.status).toBe(400);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'not-an-email',
          password: 'Password123!',
        });

      expect(response.status).toBe(400);
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'test@example.com',
          password: '123', // Too weak
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Password123!', 10);

      db.query.mockResolvedValueOnce([[{
        id: 'user-123',
        email: 'test@example.com',
        password: hashedPassword,
        email_verified: true,
        name: 'Test User',
      }]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject login with wrong password', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('CorrectPassword', 10);

      db.query.mockResolvedValueOnce([[{
        id: 'user-123',
        email: 'test@example.com',
        password: hashedPassword,
        email_verified: true,
      }]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
    });

    it('should reject login for non-existent user', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
    });
  });
});

describe('Courses API', () => {
  let app;
  const authToken = createTestToken();

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Simple auth middleware for testing
    app.use('/api/courses', (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'No token' });
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret');
        req.user = decoded;
        next();
      } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    });
    app.use('/api/courses', require('../../routes/course.routes'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/courses', () => {
    it('should return list of user courses', async () => {
      db.query.mockResolvedValueOnce([[
        { id: 'course-1', title: 'Course 1', description: 'Description 1' },
        { id: 'course-2', title: 'Course 2', description: 'Description 2' },
      ]]);

      const response = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBe('Course 1');
    });

    it('should return empty array for user with no courses', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should reject request without auth token', async () => {
      const response = await request(app).get('/api/courses');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/courses', () => {
    it('should create a new course', async () => {
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);
      db.query.mockResolvedValueOnce([[{
        id: 'new-course-id',
        title: 'New Course',
        description: 'Course description',
      }]]);

      const response = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'New Course',
          description: 'Course description',
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Course');
    });

    it('should validate required title', async () => {
      const response = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'No title provided',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/courses/:id', () => {
    it('should return course by ID', async () => {
      db.query.mockResolvedValueOnce([[{
        id: 'course-123',
        title: 'Test Course',
        description: 'Description',
        user_id: 'test-user-id',
      }]]);

      const response = await request(app)
        .get('/api/courses/course-123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Test Course');
    });

    it('should return 404 for non-existent course', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/courses/fake-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/courses/:id', () => {
    it('should delete course owned by user', async () => {
      db.query
        .mockResolvedValueOnce([[{ id: 'course-123', user_id: 'test-user-id' }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app)
        .delete('/api/courses/course-123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject deleting course not owned by user', async () => {
      db.query.mockResolvedValueOnce([[{ id: 'course-123', user_id: 'other-user' }]]);

      const response = await request(app)
        .delete('/api/courses/course-123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });
  });
});

describe('Quiz API', () => {
  let app;
  const authToken = createTestToken();

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    app.use('/api/quiz', (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'No token' });
      try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret');
        next();
      } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    });
    app.use('/api/quiz', require('../../routes/quiz.routes'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/quiz/:quizId/submit', () => {
    it('should submit and grade quiz answers', async () => {
      const mockQuiz = {
        id: 'quiz-123',
        questions: [
          { id: 'q1', correctAnswerIndex: 0 },
          { id: 'q2', correctAnswerIndex: 1 },
        ],
      };

      db.query
        .mockResolvedValueOnce([[mockQuiz]])
        .mockResolvedValueOnce([{ insertId: 1 }]);

      const response = await request(app)
        .post('/api/quiz/quiz-123/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          answers: [0, 1], // Both correct
        });

      expect(response.status).toBe(200);
      expect(response.body.score).toBe(100);
      expect(response.body.passed).toBe(true);
    });

    it('should fail quiz with low score', async () => {
      const mockQuiz = {
        id: 'quiz-123',
        questions: [
          { id: 'q1', correctAnswerIndex: 0 },
          { id: 'q2', correctAnswerIndex: 1 },
          { id: 'q3', correctAnswerIndex: 2 },
        ],
      };

      db.query
        .mockResolvedValueOnce([[mockQuiz]])
        .mockResolvedValueOnce([{ insertId: 1 }]);

      const response = await request(app)
        .post('/api/quiz/quiz-123/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          answers: [0, 0, 0], // Only 1 correct (33%)
        });

      expect(response.status).toBe(200);
      expect(response.body.passed).toBe(false);
    });
  });
});

describe('Streak API', () => {
  let app;
  const authToken = createTestToken();

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    app.use('/api/streak', (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'No token' });
      try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret');
        next();
      } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    });
    app.use('/api/streak', require('../../routes/streak.routes'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/streak', () => {
    it('should return user streak data', async () => {
      db.query.mockResolvedValueOnce([[{
        current_streak: 7,
        longest_streak: 14,
        last_activity_date: '2024-01-15',
      }]]);

      const response = await request(app)
        .get('/api/streak')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.currentStreak).toBe(7);
      expect(response.body.longestStreak).toBe(14);
    });

    it('should return 0 streak for new user', async () => {
      db.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/streak')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.currentStreak).toBe(0);
    });
  });
});
