/**
 * Auth Controller
 * HTTP-specific logic for authentication endpoints
 */

const authService = require('../services/auth.service');
const logger = require('../config/logger');

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
async function register(req, res) {
  try {
    const { email, password, firstName, lastName, languagePreference } = req.body;
    
    const user = await authService.registerUser({
      email,
      password,
      firstName,
      lastName,
      languagePreference,
    });
    
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
}

/**
 * POST /api/auth/login
 * Login with email/password
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    const user = await authService.loginWithPassword(email, password);
    
    const accessToken = authService.generateAccessToken(user);
    const { token: refreshToken, expiresAt } = await authService.generateRefreshToken(user.id);
    
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
}

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token from cookie
 */
async function refresh(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }
    
    const { accessToken, user } = await authService.refreshAccessToken(refreshToken);
    
    res.json({ accessToken, user });
  } catch (error) {
    logger.debug('Token refresh failed:', error.message);
    
    // Clear invalid cookie
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);
    
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

/**
 * POST /api/auth/logout
 * Logout and revoke refresh token
 */
async function logout(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }
    
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    // Still clear cookie even if revocation fails
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);
    res.json({ message: 'Logged out successfully' });
  }
}

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
async function verifyEmailHandler(req, res) {
  try {
    const { token } = req.body;
    
    await authService.verifyEmail(token);
    
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Email verification error:', error);
    
    if (error.message === 'Invalid or expired verification token') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
}

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    
    await authService.resendVerificationEmail(email);
    
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    logger.error('Resend verification error:', error);
    
    if (error.message === 'User not found' || error.message === 'Email already verified') {
      // Don't reveal user existence
      return res.json({ message: 'If an account exists, a verification email has been sent' });
    }
    
    res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
}

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    
    await authService.requestPasswordReset(email);
    
    // Always return success to prevent email enumeration
    res.json({ message: 'If an account exists with this email, a reset link has been sent' });
  } catch (error) {
    logger.error('Forgot password error:', error);
    // Still return success to prevent enumeration
    res.json({ message: 'If an account exists with this email, a reset link has been sent' });
  }
}

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
async function resetPasswordHandler(req, res) {
  try {
    const { token, password } = req.body;
    
    await authService.resetPassword(token, password);
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset password error:', error);
    
    if (error.message === 'Invalid or expired reset token') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
}

/**
 * POST /api/auth/change-password
 * Change password (authenticated)
 */
async function changePasswordHandler(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    
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
}

/**
 * GET /api/auth/me
 * Get current user info
 */
function getMe(req, res) {
  res.json({ user: req.user });
}

/**
 * Google OAuth callback handler
 */
async function googleCallback(req, res) {
  try {
    const user = req.user;
    
    const accessToken = authService.generateAccessToken(user);
    const { token: refreshToken } = await authService.generateRefreshToken(user.id);
    
    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    
    // Redirect to frontend with access token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}`);
  } catch (error) {
    logger.error('Google OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  verifyEmail: verifyEmailHandler,
  resendVerification,
  forgotPassword,
  resetPassword: resetPasswordHandler,
  changePassword: changePasswordHandler,
  getMe,
  googleCallback,
  REFRESH_TOKEN_COOKIE_OPTIONS,
};
