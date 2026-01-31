/**
 * User Routes
 * Routes for user profile and settings management
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const userService = require('../services/user.service');
const { body, validationResult } = require('express-validator');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/users/profile
 * Get current user's profile
 */
router.get('/profile', async (req, res) => {
  try {
    const profile = await userService.getProfile(req.user.userId);
    res.json(profile);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * PUT /api/users/profile
 * Update user profile (firstName, lastName, avatarUrl, timezone)
 */
router.put('/profile', [
  body('firstName').optional().isString().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().isString().trim().isLength({ min: 1, max: 50 }),
  body('avatarUrl').optional().isString(),
  body('timezone').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { firstName, lastName, avatarUrl, timezone } = req.body;
    const profile = await userService.updateProfile(req.user.userId, {
      firstName,
      lastName,
      avatarUrl,
      timezone,
    });
    res.json(profile);
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('too large')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * GET /api/users/settings
 * Get user settings
 */
router.get('/settings', async (req, res) => {
  try {
    const profile = await userService.getProfile(req.user.userId);
    res.json({
      languagePreference: profile.languagePreference,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * PUT /api/users/settings
 * Update user settings (languagePreference)
 */
router.put('/settings', [
  body('languagePreference').optional().isIn(['en', 'fr']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { languagePreference } = req.body;
    const settings = await userService.updateSettings(req.user.userId, {
      languagePreference,
    });
    res.json(settings);
  } catch (error) {
    if (error.message === 'Invalid language preference') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * PUT /api/users/password
 * Change password (authenticated)
 */
router.put('/password', [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user.userId, currentPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error.message === 'Current password is incorrect') {
      return res.status(401).json({ error: error.message });
    }
    if (error.message.includes('at least')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * DELETE /api/users/account
 * Delete user account
 */
router.delete('/account', [
  body('password').isString().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { password } = req.body;
    await userService.deleteAccount(req.user.userId, password);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    if (error.message === 'Password is incorrect') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
