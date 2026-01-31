/**
 * Auth Service Tests
 * Unit tests for authentication logic
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock the database and other dependencies
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

const db = require('../../config/database');
const authService = require('../../services/auth.service');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      // Mock user doesn't exist
      db.query.mockResolvedValueOnce([[]]);
      
      // Mock insert success
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);
      
      // Mock fetch created user
      db.query.mockResolvedValueOnce([[{
        id: 'new-user-id',
        email: 'new@example.com',
        first_name: 'New',
        last_name: 'User',
        email_verified: false,
        created_at: new Date(),
      }]]);

      const result = await authService.register({
        email: 'new@example.com',
        password: 'securePassword123',
        firstName: 'New',
        lastName: 'User',
      });

      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('new@example.com');
      expect(db.query).toHaveBeenCalled();
    });

    it('should throw error if email already exists', async () => {
      // Mock user exists
      db.query.mockResolvedValueOnce([[{ id: 'existing-user' }]]);

      await expect(authService.register({
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      })).rejects.toThrow('Email already registered');
    });

    it('should hash the password before storing', async () => {
      db.query.mockResolvedValueOnce([[]]);
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);
      db.query.mockResolvedValueOnce([[{
        id: 'new-user-id',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        email_verified: false,
        created_at: new Date(),
      }]]);

      await authService.register({
        email: 'test@example.com',
        password: 'myPassword123',
        firstName: 'Test',
        lastName: 'User',
      });

      // Check that the password was hashed (10 rounds default)
      const insertCall = db.query.mock.calls[1];
      const hashedPassword = insertCall[1][2]; // Third param is password
      expect(hashedPassword).not.toBe('myPassword123');
      expect(hashedPassword.startsWith('$2')).toBe(true); // bcrypt hash prefix
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('correctPassword', 10);
      
      db.query.mockResolvedValueOnce([[{
        id: 'user-id',
        email: 'user@example.com',
        password_hash: hashedPassword,
        first_name: 'Test',
        last_name: 'User',
        email_verified: true,
        language_preference: 'en',
        created_at: new Date(),
      }]]);

      const result = await authService.login('user@example.com', 'correctPassword');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('user@example.com');
    });

    it('should throw error for invalid email', async () => {
      db.query.mockResolvedValueOnce([[]]);

      await expect(authService.login('nonexistent@example.com', 'password'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      const hashedPassword = await bcrypt.hash('correctPassword', 10);
      
      db.query.mockResolvedValueOnce([[{
        id: 'user-id',
        email: 'user@example.com',
        password_hash: hashedPassword,
        first_name: 'Test',
        last_name: 'User',
        email_verified: true,
        created_at: new Date(),
      }]]);

      await expect(authService.login('user@example.com', 'wrongPassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for unverified email', async () => {
      const hashedPassword = await bcrypt.hash('password', 10);
      
      db.query.mockResolvedValueOnce([[{
        id: 'user-id',
        email: 'user@example.com',
        password_hash: hashedPassword,
        first_name: 'Test',
        last_name: 'User',
        email_verified: false,
        created_at: new Date(),
      }]]);

      await expect(authService.login('user@example.com', 'password'))
        .rejects.toThrow('verify your email');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid JWT token', () => {
      const payload = { userId: 'test-id', email: 'test@example.com' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

      const decoded = authService.verifyToken(token);

      expect(decoded.userId).toBe('test-id');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should throw error for expired token', () => {
      const payload = { userId: 'test-id' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1h' });

      expect(() => authService.verifyToken(token)).toThrow();
    });

    it('should throw error for invalid token', () => {
      expect(() => authService.verifyToken('invalid-token')).toThrow();
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const user = { id: 'user-id', email: 'test@example.com' };
      
      const tokens = authService.generateTokens(user);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should include user info in token payload', () => {
      const user = { id: 'user-id', email: 'test@example.com' };
      
      const tokens = authService.generateTokens(user);
      const decoded = jwt.verify(tokens.accessToken, process.env.JWT_SECRET);

      expect(decoded.userId).toBe('user-id');
      expect(decoded.email).toBe('test@example.com');
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new access token from valid refresh token', async () => {
      const user = { id: 'user-id', email: 'test@example.com' };
      const refreshToken = jwt.sign(
        { userId: user.id, email: user.email, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Mock user fetch
      db.query.mockResolvedValueOnce([[{
        id: 'user-id',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        email_verified: true,
        language_preference: 'en',
        created_at: new Date(),
      }]]);

      const result = await authService.refreshAccessToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(typeof result.accessToken).toBe('string');
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(authService.refreshAccessToken('invalid-token'))
        .rejects.toThrow();
    });
  });
});

describe('Password Hashing', () => {
  it('should correctly compare hashed passwords', async () => {
    const password = 'mySecurePassword123';
    const hash = await bcrypt.hash(password, 10);

    const isMatch = await bcrypt.compare(password, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await bcrypt.compare('wrongPassword', hash);
    expect(isWrongMatch).toBe(false);
  });
});
