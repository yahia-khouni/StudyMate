const express = require('express');
const passport = require('../config/passport');
const {
  createUser,
  loginWithPassword,
  verifyEmail,
  resendVerificationEmail,
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  requestPasswordReset,
  resetPassword,
  changePassword,
  initializeUserStreak,
} = require('../services/auth.service');
const { authenticate } = require('../middleware/auth');
const {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  verifyEmailValidation,
  resendVerificationValidation,
} = require('../middleware/validation');
const logger = require('../config/logger');

const router = express.Router();

// Cookie options for refresh token
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

/**
 * POST /api/auth/register
 * Register a new user with email/password
 */
router.post('/register', registerValidation, async (req, res) => {
  try {
    const { email, password, firstName, lastName, languagePreference } = req.body;
    
    const user = await createUser({
      email,
      password,
      firstName,
      lastName,
      languagePreference,
    });
    
    // Initialize streak for new user
    await initializeUserStreak(user.id);
    
    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    
    if (error.message === 'Email already registered') {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /api/auth/login
 * Login with email/password
 */
router.post('/login', loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await loginWithPassword(email, password);
    
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, expiresAt } = await generateRefreshToken(user.id);
    
    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    
    res.json({
      accessToken,
      user,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error('Login error:', error);
    
    if (error.message === 'Invalid email or password') {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token from cookie
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }
    
    const { accessToken, user } = await refreshAccessToken(refreshToken);
    
    res.json({ accessToken, user });
  } catch (error) {
    logger.debug('Token refresh failed:', error.message);
    
    // Clear invalid cookie
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);
    
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

/**
 * POST /api/auth/logout
 * Logout and revoke refresh token
 */
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    // Still clear cookie even if revocation fails
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);
    res.json({ message: 'Logged out successfully' });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', verifyEmailValidation, async (req, res) => {
  try {
    const { token } = req.body;
    
    await verifyEmail(token);
    
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Email verification error:', error);
    
    if (error.message === 'Invalid or expired verification token') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', resendVerificationValidation, async (req, res) => {
  try {
    const { email } = req.body;
    
    await resendVerificationEmail(email);
    
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    logger.error('Resend verification error:', error);
    
    if (error.message === 'User not found' || error.message === 'Email already verified') {
      // Don't reveal user existence
      return res.json({ message: 'If an account exists, a verification email has been sent' });
    }
    
    res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', forgotPasswordValidation, async (req, res) => {
  try {
    const { email } = req.body;
    
    await requestPasswordReset(email);
    
    // Always return success to prevent email enumeration
    res.json({ message: 'If an account exists with this email, a reset link has been sent' });
  } catch (error) {
    logger.error('Forgot password error:', error);
    // Still return success to prevent enumeration
    res.json({ message: 'If an account exists with this email, a reset link has been sent' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', resetPasswordValidation, async (req, res) => {
  try {
    const { token, password } = req.body;
    
    await resetPassword(token, password);
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset password error:', error);
    
    if (error.message === 'Invalid or expired reset token') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (authenticated)
 */
router.post('/change-password', authenticate, changePasswordValidation, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    await changePassword(req.user.id, currentPassword, newPassword);
    
    // Clear refresh token cookie (user needs to re-login)
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);
    
    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    logger.error('Change password error:', error);
    
    if (error.message === 'Current password is incorrect') {
      return res.status(400).json({ error: error.message });
    }
    
    if (error.message === 'Cannot change password for OAuth-only accounts') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to change password. Please try again.' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ============================================
// Google OAuth Routes
// ============================================

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
  }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Initialize streak if new user (check if streak exists)
      try {
        await initializeUserStreak(user.id);
      } catch (e) {
        // Streak might already exist, ignore duplicate key error
      }
      
      const accessToken = generateAccessToken(user);
      const { token: refreshToken } = await generateRefreshToken(user.id);
      
      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
      
      // Redirect to frontend with access token
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}`);
    } catch (error) {
      logger.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }
);

module.exports = router;
