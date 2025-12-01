const { verifyAccessToken, getUserById } = require('../services/auth.service');
const logger = require('../config/logger');

/**
 * Authenticate user via JWT access token
 * Adds user object to req.user
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);
    
    // Get fresh user data
    const user = await getUserById(decoded.sub);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    
    next();
  } catch (error) {
    logger.debug('Authentication failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require email verification
 * Use after authenticate middleware
 */
function requireEmailVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.user.emailVerified) {
    return res.status(403).json({ 
      error: 'Email not verified',
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email to access this feature'
    });
  }
  
  next();
}

/**
 * Optional authentication - doesn't fail if no token
 * Adds user to req.user if token is valid, otherwise req.user is undefined
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);
    
    const user = await getUserById(decoded.sub);
    
    if (user) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Token invalid, continue without user
    next();
  }
}

module.exports = {
  authenticate,
  requireEmailVerified,
  optionalAuth,
};
