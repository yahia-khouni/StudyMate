/**
 * Reminder Worker
 * Background jobs for deadline reminders and streak reminders
 */

const { Worker, Queue } = require('bullmq');
const logger = require('../config/logger');
const CalendarModel = require('../models/calendar.model');
const streakService = require('../services/streak.service');
const notificationService = require('../services/notification.service');
const emailService = require('../services/email.service');
const { redisConnection } = require('./queue');

const QUEUE_NAME = 'reminders';

// Create the queue
const reminderQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

/**
 * Process deadline reminders
 * Checks for upcoming events and sends notifications
 */
async function processDeadlineReminders() {
  try {
    logger.info('[REMINDER] Checking for deadline reminders...');
    
    // Get events with reminders due (within next 24 hours by default)
    const events = await CalendarModel.findUpcomingReminders(1440);
    
    logger.info(`[REMINDER] Found ${events.length} events needing reminders`);
    
    for (const event of events) {
      try {
        // Calculate time until event
        const now = new Date();
        const eventTime = new Date(event.start_date);
        const minutesUntil = Math.round((eventTime - now) / (1000 * 60));
        const hoursUntil = Math.round(minutesUntil / 60);
        
        // Create in-app notification
        await notificationService.create({
          userId: event.user_id,
          type: 'deadline_reminder',
          title: getEventTypeEmoji(event.event_type) + ' ' + event.title,
          message: `Starts in ${hoursUntil > 0 ? hoursUntil + ' hours' : minutesUntil + ' minutes'}`,
          link: '/calendar',
        });
        
        // Send email notification
        if (event.email) {
          await emailService.sendEmail({
            to: event.email,
            subject: `Reminder: ${event.title}`,
            html: generateDeadlineEmailHtml(event, hoursUntil, event.language_preference || 'en'),
          });
        }
        
        // Mark reminder as sent
        await CalendarModel.markReminderSent(event.id);
        
        logger.info(`[REMINDER] Sent reminder for event: ${event.id}`);
      } catch (error) {
        logger.error(`[REMINDER] Failed to send reminder for event ${event.id}:`, error);
      }
    }
    
    return { processed: events.length };
  } catch (error) {
    logger.error('[REMINDER] Deadline reminder processing failed:', error);
    throw error;
  }
}

/**
 * Process streak reminders
 * Sends reminders to users who haven't logged activity today
 */
async function processStreakReminders() {
  try {
    logger.info('[REMINDER] Checking for streak reminders...');
    
    // Get users with active streaks but no activity today
    const users = await streakService.getUsersNeedingStreakReminder();
    
    logger.info(`[REMINDER] Found ${users.length} users needing streak reminders`);
    
    for (const user of users) {
      try {
        // Create in-app notification
        await notificationService.create({
          userId: user.user_id,
          type: 'streak_reminder',
          title: '🔥 Don\'t lose your streak!',
          message: `You have a ${user.current_streak}-day streak. Study today to keep it going!`,
          link: '/dashboard',
        });
        
        // Send email notification
        if (user.email) {
          await emailService.sendEmail({
            to: user.email,
            subject: `🔥 Don't lose your ${user.current_streak}-day streak!`,
            html: generateStreakEmailHtml(user, user.language_preference || 'en'),
          });
        }
        
        logger.info(`[REMINDER] Sent streak reminder to user: ${user.user_id}`);
      } catch (error) {
        logger.error(`[REMINDER] Failed to send streak reminder to user ${user.user_id}:`, error);
      }
    }
    
    return { processed: users.length };
  } catch (error) {
    logger.error('[REMINDER] Streak reminder processing failed:', error);
    throw error;
  }
}

/**
 * Get emoji for event type
 */
function getEventTypeEmoji(eventType) {
  const emojis = {
    study: '📚',
    deadline: '⏰',
    exam: '📝',
    other: '📌',
  };
  return emojis[eventType] || '📌';
}

/**
 * Generate deadline reminder email HTML
 */
function generateDeadlineEmailHtml(event, hoursUntil, lang) {
  const isEnglish = lang === 'en';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .event-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .event-type { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .study { background: #dbeafe; color: #1e40af; }
        .deadline { background: #fef3c7; color: #92400e; }
        .exam { background: #fce7f3; color: #9d174d; }
        .time-badge { background: #f97316; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; }
        .btn { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">${isEnglish ? 'Event Reminder' : 'Rappel d\'événement'}</h1>
        </div>
        <div class="content">
          <div class="event-card">
            <span class="event-type ${event.event_type}">${event.event_type.toUpperCase()}</span>
            <h2 style="margin: 16px 0 8px;">${event.title}</h2>
            ${event.description ? `<p style="color: #64748b;">${event.description}</p>` : ''}
            <p>
              <span class="time-badge">
                ${isEnglish ? `Starts in ${hoursUntil} hours` : `Commence dans ${hoursUntil} heures`}
              </span>
            </p>
            <p style="color: #64748b;">
              📅 ${new Date(event.start_date).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <p style="text-align: center; margin-top: 24px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/calendar" class="btn">
              ${isEnglish ? 'View Calendar' : 'Voir le calendrier'}
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate streak reminder email HTML
 */
function generateStreakEmailHtml(user, lang) {
  const isEnglish = lang === 'en';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f97316, #ef4444); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; text-align: center; }
        .streak-count { font-size: 64px; font-weight: bold; color: #f97316; }
        .flame { font-size: 48px; }
        .btn { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="flame">🔥</span>
          <h1 style="margin: 10px 0 0;">
            ${isEnglish ? "Don't Break Your Streak!" : "Ne perdez pas votre série !"}
          </h1>
        </div>
        <div class="content">
          <p style="font-size: 18px;">
            ${isEnglish 
              ? `Hey ${user.first_name}! You have an amazing` 
              : `Salut ${user.first_name} ! Tu as une incroyable série de`}
          </p>
          <p class="streak-count">${user.current_streak}</p>
          <p style="font-size: 18px; color: #64748b;">
            ${isEnglish ? 'day streak going!' : 'jours en cours !'}
          </p>
          <p style="margin: 24px 0;">
            ${isEnglish 
              ? "Study for just a few minutes today to keep your streak alive!" 
              : "Étudie quelques minutes aujourd'hui pour maintenir ta série !"}
          </p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="btn">
            ${isEnglish ? 'Study Now' : 'Étudier maintenant'}
          </a>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Create the worker
let reminderWorker = null;

function initializeReminderWorker() {
  reminderWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      logger.info(`[REMINDER] Processing job: ${job.name}`);
      
      switch (job.name) {
        case 'deadline-reminders':
          return processDeadlineReminders();
        case 'streak-reminders':
          return processStreakReminders();
        default:
          logger.warn(`[REMINDER] Unknown job type: ${job.name}`);
          return null;
      }
    },
    { connection: redisConnection }
  );

  reminderWorker.on('completed', (job, result) => {
    logger.info(`[REMINDER] Job ${job.name} completed:`, result);
  });

  reminderWorker.on('failed', (job, error) => {
    logger.error(`[REMINDER] Job ${job?.name} failed:`, error);
  });

  logger.info('[REMINDER] Reminder worker initialized');
  return reminderWorker;
}

/**
 * Schedule recurring reminder jobs
 */
async function scheduleReminderJobs() {
  try {
    // Remove any existing repeatable jobs
    const repeatableJobs = await reminderQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await reminderQueue.removeRepeatableByKey(job.key);
    }

    // Schedule deadline reminder checks every 15 minutes
    await reminderQueue.add(
      'deadline-reminders',
      {},
      {
        repeat: {
          pattern: '*/15 * * * *', // Every 15 minutes
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );

    // Schedule streak reminders at 6 PM daily (local time)
    await reminderQueue.add(
      'streak-reminders',
      {},
      {
        repeat: {
          pattern: '0 18 * * *', // 6 PM daily
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );

    logger.info('[REMINDER] Scheduled repeatable reminder jobs');
  } catch (error) {
    logger.error('[REMINDER] Failed to schedule reminder jobs:', error);
  }
}

module.exports = {
  initializeReminderWorker,
  scheduleReminderJobs,
  reminderQueue,
  processDeadlineReminders,
  processStreakReminders,
};
