/**
 * Auth Routes
 * Maps URLs to auth controller methods
 */

const express = require('express');
const passport = require('../config/passport');
const authController = require('../controllers/auth.controller');
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

const router = express.Router();

// ============================================
// Email/Password Authentication
// ============================================

// Register new user
router.post('/register', registerValidation, authController.register);

// Login
router.post('/login', loginValidation, authController.login);

// Refresh access token
router.post('/refresh', authController.refresh);

// Logout
router.post('/logout', authController.logout);

// ============================================
// Email Verification
// ============================================

// Verify email with token
router.post('/verify-email', verifyEmailValidation, authController.verifyEmail);

// Resend verification email
router.post('/resend-verification', resendVerificationValidation, authController.resendVerification);

// ============================================
// Password Management
// ============================================

// Request password reset
router.post('/forgot-password', forgotPasswordValidation, authController.forgotPassword);

// Reset password with token
router.post('/reset-password', resetPasswordValidation, authController.resetPassword);

// Change password (authenticated)
router.post('/change-password', authenticate, changePasswordValidation, authController.changePassword);

// ============================================
// User Profile
// ============================================

// Get current user
router.get('/me', authenticate, authController.getMe);

// ============================================
// Google OAuth
// ============================================

// Initiate Google OAuth flow
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
  }),
  authController.googleCallback
);

module.exports = router;
