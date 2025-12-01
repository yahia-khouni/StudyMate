const nodemailer = require('nodemailer');
const logger = require('../config/logger');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false, // true for 465, false for other ports
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

// Verify connection on startup
transporter.verify()
  .then(() => logger.info('Email transporter ready'))
  .catch((err) => logger.warn('Email transporter not ready:', err.message));

/**
 * Send an email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content
 */
async function sendEmail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@studyai.local',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Send verification email
 * @param {string} email - User email
 * @param {string} firstName - User's first name
 * @param {string} token - Verification token
 */
async function sendVerificationEmail(email, firstName, token) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .logo { font-size: 28px; font-weight: bold; color: #6366f1; }
        .content { background: #f8fafc; border-radius: 12px; padding: 30px; margin: 20px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { text-align: center; color: #64748b; font-size: 14px; padding: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">📚 StudyAI</div>
        </div>
        <div class="content">
          <h2>Welcome to StudyAI, ${firstName}!</h2>
          <p>Thank you for signing up. Please verify your email address to unlock all features:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" class="button">Verify Email Address</a>
          </p>
          <p style="color: #64748b; font-size: 14px;">
            This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
        <div class="footer">
          <p>© 2025 StudyAI. Built with ❤️ for students.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: email,
    subject: 'Verify your StudyAI account',
    html,
  });
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} firstName - User's first name
 * @param {string} token - Reset token
 */
async function sendPasswordResetEmail(email, firstName, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .logo { font-size: 28px; font-weight: bold; color: #6366f1; }
        .content { background: #f8fafc; border-radius: 12px; padding: 30px; margin: 20px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { text-align: center; color: #64748b; font-size: 14px; padding: 20px 0; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">📚 StudyAI</div>
        </div>
        <div class="content">
          <h2>Reset Your Password</h2>
          <p>Hi ${firstName},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email and your password will remain unchanged.
          </div>
        </div>
        <div class="footer">
          <p>© 2025 StudyAI. Built with ❤️ for students.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: email,
    subject: 'Reset your StudyAI password',
    html,
  });
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
