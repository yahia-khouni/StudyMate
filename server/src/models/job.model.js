/**
 * Job Model
 * Database operations for job_metadata table (BullMQ job tracking)
 */

const db = require('../config/database');
const { generateId } = require('../utils/helpers');

/**
 * Create a job metadata record
 * @param {Object} jobData
 * @returns {Promise<Object>}
 */
async function create({ jobId, jobType, entityType, entityId }) {
  const id = generateId();
  
  await db.query(
    `INSERT INTO job_metadata (id, job_id, job_type, entity_type, entity_id)
     VALUES (?, ?, ?, ?, ?)`,
    [id, jobId, jobType, entityType, entityId]
  );
  
  return findById(id);
}

/**
 * Find job by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await db.query(
    `SELECT * FROM job_metadata WHERE id = ?`,
    [id]
  );
  return rows[0] ? formatJob(rows[0]) : null;
}

/**
 * Find job by BullMQ job ID
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
async function findByJobId(jobId) {
  const [rows] = await db.query(
    `SELECT * FROM job_metadata WHERE job_id = ?`,
    [jobId]
  );
  return rows[0] ? formatJob(rows[0]) : null;
}

/**
 * Find jobs by entity
 * @param {string} entityType
 * @param {string} entityId
 * @returns {Promise<Array>}
 */
async function findByEntity(entityType, entityId) {
  const [rows] = await db.query(
    `SELECT * FROM job_metadata 
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY created_at DESC`,
    [entityType, entityId]
  );
  return rows.map(formatJob);
}

/**
 * Find pending jobs by type
 * @param {string} jobType
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function findPendingByType(jobType, limit = 10) {
  const [rows] = await db.query(
    `SELECT * FROM job_metadata 
     WHERE job_type = ? AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT ?`,
    [jobType, limit]
  );
  return rows.map(formatJob);
}

/**
 * Update job status
 * @param {string} jobId - BullMQ job ID
 * @param {string} status
 * @param {Object} extra - Additional updates
 * @returns {Promise<void>}
 */
async function updateStatus(jobId, status, { progress, errorMessage, startedAt, completedAt } = {}) {
  const updates = ['status = ?'];
  const values = [status];
  
  if (progress !== undefined) {
    updates.push('progress = ?');
    values.push(progress);
  }
  if (errorMessage !== undefined) {
    updates.push('error_message = ?');
    values.push(errorMessage);
  }
  if (startedAt !== undefined) {
    updates.push('started_at = ?');
    values.push(startedAt);
  }
  if (completedAt !== undefined) {
    updates.push('completed_at = ?');
    values.push(completedAt);
  }
  
  values.push(jobId);
  await db.query(
    `UPDATE job_metadata SET ${updates.join(', ')} WHERE job_id = ?`,
    values
  );
}

/**
 * Update job progress
 * @param {string} jobId
 * @param {number} progress
 * @returns {Promise<void>}
 */
async function updateProgress(jobId, progress) {
  await db.query(
    `UPDATE job_metadata SET progress = ? WHERE job_id = ?`,
    [progress, jobId]
  );
}

/**
 * Mark job as started
 * @param {string} jobId
 * @returns {Promise<void>}
 */
async function markStarted(jobId) {
  await db.query(
    `UPDATE job_metadata SET status = 'processing', started_at = NOW() WHERE job_id = ?`,
    [jobId]
  );
}

/**
 * Mark job as completed
 * @param {string} jobId
 * @returns {Promise<void>}
 */
async function markCompleted(jobId) {
  await db.query(
    `UPDATE job_metadata SET status = 'completed', progress = 100, completed_at = NOW() WHERE job_id = ?`,
    [jobId]
  );
}

/**
 * Mark job as failed
 * @param {string} jobId
 * @param {string} errorMessage
 * @returns {Promise<void>}
 */
async function markFailed(jobId, errorMessage) {
  await db.query(
    `UPDATE job_metadata SET status = 'failed', error_message = ?, completed_at = NOW() WHERE job_id = ?`,
    [errorMessage, jobId]
  );
}

/**
 * Clean up old completed jobs
 * @param {number} daysOld
 * @returns {Promise<number>}
 */
async function cleanupOldJobs(daysOld = 30) {
  const [result] = await db.query(
    `DELETE FROM job_metadata 
     WHERE status IN ('completed', 'failed') 
     AND completed_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [daysOld]
  );
  return result.affectedRows;
}

/**
 * Format job object for API response
 * @param {Object} job
 * @returns {Object}
 */
function formatJob(job) {
  if (!job) return null;
  
  return {
    id: job.id,
    jobId: job.job_id,
    jobType: job.job_type,
    entityType: job.entity_type,
    entityId: job.entity_id,
    status: job.status,
    progress: job.progress,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  };
}

module.exports = {
  create,
  findById,
  findByJobId,
  findByEntity,
  findPendingByType,
  updateStatus,
  updateProgress,
  markStarted,
  markCompleted,
  markFailed,
  cleanupOldJobs,
  formatJob,
};
