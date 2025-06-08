const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Initialize database connection
const db = new Database(path.join(__dirname, "..", "dmautomation.db"), {
  verbose: console.log,
});

// Initialize tables from schema
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

// ...existing code...

const scheduleDM = (scheduleData) => {
  try {
    // Add debug logging
    console.log("Attempting to schedule DM with data:", {
      fromUsername: scheduleData.fromUsername,
      targetCount: scheduleData.targetUsernames?.length,
      messageCount: scheduleData.messageVariations?.length,
      scheduleTime: scheduleData.scheduleTime,
    });

    // Validate required fields
    if (
      !scheduleData.fromUsername ||
      !scheduleData.targetUsernames ||
      !scheduleData.messageVariations ||
      !scheduleData.scheduleTime
    ) {
      throw new Error("Missing required fields for scheduling DM");
    }

    const stmt = db.prepare(`
      INSERT INTO scheduled_jobs (
        from_username,
        target_usernames,
        message_variations,
        schedule_time,
        campaign_id,
        status,
        is_recurring,
        recurring_interval
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      scheduleData.fromUsername,
      JSON.stringify(scheduleData.targetUsernames),
      JSON.stringify(scheduleData.messageVariations),
      scheduleData.scheduleTime,
      scheduleData.campaignId || null,
      "pending",
      scheduleData.isRecurring ? 1 : 0,
      scheduleData.recurringInterval || null
    );

    console.log("DM scheduled successfully:", result);
    return result.lastInsertRowid;
  } catch (error) {
    console.error("Error scheduling DM:", error);
    throw error;
  }
};

const getDMStats = () => {
  try {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_dms,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_dms
      FROM dm_logs
    `);
    return stmt.get();
  } catch (error) {
    console.error("Error getting DM stats:", error);
    throw error;
  }
};
// ...existing code...

const getPendingJobs = () => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM scheduled_jobs 
      WHERE status = 'pending' 
      AND schedule_time <= datetime('now', 'localtime')
      AND (
        is_recurring = 1 
        OR (is_recurring = 0 AND last_run IS NULL)
      )
      ORDER BY schedule_time ASC
    `);

    const jobs = stmt.all();
    return jobs.map((job) => ({
      ...job,
      target_usernames: JSON.parse(job.target_usernames),
      message_variations: JSON.parse(job.message_variations),
    }));
  } catch (error) {
    console.error("Error getting pending jobs:", error);
    throw error;
  }
};

const getScheduledJobs = () => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM scheduled_jobs 
      ORDER BY schedule_time ASC
    `);
    const jobs = stmt.all();
    return jobs.map((job) => ({
      ...job,
      target_usernames: JSON.parse(job.target_usernames),
      message_variations: JSON.parse(job.message_variations),
    }));
  } catch (error) {
    console.error("Error getting scheduled jobs:", error);
    throw error;
  }
};
const updateJobStatus = (jobId, status, errorLog = null) => {
  try {
    const stmt = db.prepare(`
      UPDATE scheduled_jobs 
      SET status = ?,
          last_run = datetime('now', 'localtime'),
          error_log = ?
      WHERE id = ?
    `);

    const result = stmt.run(status, errorLog, jobId);
    return result.changes > 0;
  } catch (error) {
    console.error("Error updating job status:", error);
    throw error;
  }
};
// Database functions
const createCampaign = (campaignData) => {
  const stmt = db.prepare(`
    INSERT INTO campaigns (
      name, 
      account_username, 
      message_variations, 
      target_usernames,
      schedule_time,
      is_scheduled,
      target_count,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    campaignData.name,
    campaignData.account_username,
    JSON.stringify(campaignData.message_variations),
    JSON.stringify(campaignData.target_usernames),
    campaignData.is_scheduled ? campaignData.schedule_time : null,
    campaignData.is_scheduled ? 1 : 0,
    campaignData.target_usernames.length,
    "pending"
  );

  return result.lastInsertRowid;
};

const getCampaigns = () => {
  const stmt = db.prepare("SELECT * FROM campaigns ORDER BY created_at DESC");
  const campaigns = stmt.all();
  return campaigns.map((campaign) => ({
    ...campaign,
    message_variations: JSON.parse(campaign.message_variations),
    target_usernames: JSON.parse(campaign.target_usernames),
    variation_stats: campaign.variation_stats
      ? JSON.parse(campaign.variation_stats)
      : [],
    is_scheduled: Boolean(campaign.is_scheduled),
  }));
};

const updateCampaignStatus = (id, status) => {
  const stmt = db.prepare(`
    UPDATE campaigns 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  return stmt.run(status, id);
};

const deleteCampaign = (id) => {
  const stmt = db.prepare("DELETE FROM campaigns WHERE id = ?");
  return stmt.run(id);
};

const updateCampaignStats = (campaignId, stats) => {
  const stmt = db.prepare(`
    UPDATE campaigns 
    SET success_count = success_count + ?,
        response_count = response_count + ?,
        variation_stats = ?,
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);

  return stmt.run(
    stats.success_count || 0,
    stats.response_count || 0,
    JSON.stringify(stats.variation_stats || []),
    campaignId
  );
};

// Export database instance and functions
module.exports = {
  db,
  createCampaign,
  getCampaigns,
  updateCampaignStatus,
  deleteCampaign,
  updateCampaignStats,
  scheduleDM,
  getDMStats, // Add this
  getScheduledJobs,
  getPendingJobs,
  updateJobStatus,
};
