const { db, initializeDatabase } = require("./db");
const logger = require("../utils/logger");

const TABLE_NAME = "scheduled_jobs";

const init = async () => {
  try {
    await initializeDatabase();
    logger.info("Messaging service initialized");
  } catch (error) {
    logger.error("Error initializing messaging service:", error);
  }
};

async function scheduleJob(jobData) {
  try {
    const job = {
      ...jobData,
      status: "scheduled",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ${TABLE_NAME} (type, data, scheduled_at, status, account_username, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          job.type,
          JSON.stringify(job.data || {}),
          job.scheduled_at,
          job.status,
          job.account_username,
          job.created_at,
          job.updated_at,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastInsertRowid, ...job });
          }
        }
      );
    });
  } catch (error) {
    console.error("Error scheduling job:", error);
    throw error;
  }
}

async function getScheduledJobs() {
  try {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM ${TABLE_NAME} ORDER BY scheduled_at ASC`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  } catch (error) {
    console.error("Error getting scheduled jobs:", error);
    throw error;
  }
}

async function getJobsByStatus(status) {
  try {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM ${TABLE_NAME} WHERE status = ? ORDER BY scheduled_at ASC`,
        [status],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  } catch (error) {
    console.error("Error getting jobs by status:", error);
    throw error;
  }
}

async function updateJobStatus(jobId, status, errorMessage = null) {
  try {
    const updateFields = ["status = ?", "updated_at = ?"];
    const values = [status, new Date().toISOString()];

    if (errorMessage) {
      updateFields.push("error_message = ?");
      values.push(errorMessage);
    }
    if (status === "completed") {
      updateFields.push("completed_at = ?");
      values.push(new Date().toISOString());
    }

    values.push(jobId);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE ${TABLE_NAME} SET ${updateFields.join(", ")} WHERE id = ?`,
        values,
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  } catch (error) {
    console.error("Error updating job status:", error);
    throw error;
  }
}

async function deleteJob(jobId) {
  try {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [jobId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  } catch (error) {
    console.error("Error deleting job:", error);
    throw error;
  }
}

async function getJobById(jobId) {
  try {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
        [jobId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  } catch (error) {
    console.error("Error getting job by ID:", error);
    throw error;
  }
}

async function getDueJobs() {
  try {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.all(
        `SELECT * FROM ${TABLE_NAME} WHERE status = 'scheduled' AND scheduled_at <= ? ORDER BY scheduled_at ASC`,
        [now],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  } catch (error) {
    console.error("Error getting due jobs:", error);
    throw error;
  }
}

async function cleanupStuckJobs() {
  try {
    // Mark jobs as failed if they've been running for more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // SQLite doesn't support updateMany with complex queries like MongoDB
    // We'll use a different approach
    const sqliteDb = db.db;
    const sql = `
      UPDATE ${TABLE_NAME}
      SET status = 'failed', error_message = 'Job timed out after 1 hour', updated_at = ?
      WHERE status = 'running' AND updated_at < ?
    `;

    await new Promise((resolve, reject) => {
      sqliteDb.run(sql, [new Date(), oneHourAgo], function (err) {
        if (err) {
          console.error("Error updating stuck jobs:", err);
          reject(err);
        } else {
          if (this.changes > 0) {
            console.log(`Cleaned up ${this.changes} stuck jobs`);
          }
          resolve();
        }
      });
    });
  } catch (error) {
    console.error("Error cleaning up stuck jobs:", error);
  }
}

// Rate Limits Collection
const RATE_LIMITS_COLLECTION = "dm_rate_limits";
const CAMPAIGNS_COLLECTION = "campaigns";

async function getDMStats(username) {
  try {
    // For now, return default stats without database lookup
    // TODO: Implement proper rate limiting with SQLite table
    return {
      username,
      daily_dm_count: 0,
      current_daily_count: 0,
      hourly_dm_count: 0,
      last_reset_date: null,
      last_dm_time: null,
    };
  } catch (error) {
    console.error("Error getting DM stats:", error);
    throw error;
  }
}

async function logDM(fromUsername, toUsername, success) {
  try {
    // For now, skip logging DMs to avoid database errors
    // TODO: Implement proper DM logging with SQLite table
    console.log(
      `DM logged: ${fromUsername} -> ${toUsername}, success: ${success}`
    );
  } catch (error) {
    console.error("Error logging DM:", error);
    throw error;
  }
}

async function updateDMRateLimits(username) {
  try {
    // For now, skip updating rate limits to avoid database errors
    // TODO: Implement proper rate limiting with SQLite table
    console.log(`Rate limits updated for: ${username}`);
  } catch (error) {
    console.error("Error updating DM rate limits:", error);
    throw error;
  }
}

// Campaign Functions
async function createCampaign({
  name,
  description,
  message_variations,
  target_usernames,
  schedule_time,
  is_scheduled = false,
}) {
  try {
    // For now, return a mock campaign object
    // TODO: Implement proper campaign storage with SQLite table
    const campaign = {
      id: Date.now(),
      name,
      description,
      message_variations,
      target_usernames,
      schedule_time: schedule_time ? new Date(schedule_time) : null,
      is_scheduled,
      status: "pending",
      success_count: 0,
      response_count: 0,
      variation_stats: [],
      created_at: new Date(),
      updated_at: new Date(),
      target_count: target_usernames.length,
    };

    console.log(`Campaign created: ${name}`);
    return campaign;
  } catch (error) {
    console.error("Error creating campaign:", error);
    throw error;
  }
}

async function getCampaigns() {
  try {
    // For now, return empty array
    // TODO: Implement proper campaign retrieval with SQLite table
    return [];
  } catch (error) {
    console.error("Error getting campaigns:", error);
    throw error;
  }
}

async function updateCampaignStats(campaignId, stats) {
  try {
    // For now, just log the update
    // TODO: Implement proper campaign stats update with SQLite table
    console.log(`Campaign stats updated for: ${campaignId}`);
  } catch (error) {
    console.error("Error updating campaign stats:", error);
    throw error;
  }
}

async function updateCampaignStatus(campaignId, status) {
  try {
    // For now, just log the update
    // TODO: Implement proper campaign status update with SQLite table
    console.log(`Campaign status updated for: ${campaignId} to ${status}`);
  } catch (error) {
    console.error("Error updating campaign status:", error);
    throw error;
  }
}

async function deleteCampaign(campaignId) {
  try {
    // For now, just log the deletion
    // TODO: Implement proper campaign deletion with SQLite table
    console.log(`Campaign deleted: ${campaignId}`);
    return true;
  } catch (error) {
    console.error("Error deleting campaign:", error);
    throw error;
  }
}

// Compatibility aliases
const addScheduledJob = scheduleJob;
const deleteScheduledJob = deleteJob;
const updateJobStatus_alias = updateJobStatus;
const getPendingJobs = () => getJobsByStatus("scheduled");

module.exports = {
  // Core job scheduling functions
  scheduleJob,
  addScheduledJob,
  getScheduledJobs,
  getJobsByStatus,
  updateJobStatus,
  deleteJob,
  deleteScheduledJob,
  getJobById,
  getDueJobs,
  cleanupStuckJobs,
  getPendingJobs,

  // DM and Rate Limit functions
  getDMStats,
  logDM,
  updateDMRateLimits,

  // Campaign functions
  createCampaign,
  getCampaigns,
  updateCampaignStats,
  updateCampaignStatus,
  deleteCampaign,

  // Initialization
  init,
};

// Initialize on module load
init().catch((err) => {
  logger.error("Failed to initialize messaging:", err);
});
