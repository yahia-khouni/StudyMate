const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { processGoogleAuth } = require('../services/auth.service');
const logger = require('./logger');

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await processGoogleAuth(profile);
        done(null, user);
      } catch (error) {
        logger.error('Google OAuth error:', error);
        done(error, null);
      }
    }
  )
);

// Serialize user for session (we're not using sessions, but passport requires this)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  done(null, { id });
});

module.exports = passport;
