const db = require("./db");

// Scheduled Jobs
function addScheduledJob({
  fromUsername,
  targetUsernames,
  messageVariations,
  scheduleTime,
  isRecurring,
  recurringInterval,
}) {
  console.log("Adding scheduled job:", {
    fromUsername,
    targetCount: targetUsernames.length,
    messageCount: messageVariations.length,
    scheduleTime,
    isRecurring,
  });
  // Convert schedule time to a proper datetime and format it for SQLite
  const scheduleDate = new Date(scheduleTime);
  console.log("Schedule time details:", {
    original: scheduleTime,
    parsed: scheduleDate.toISOString(),
    local: scheduleDate.toLocaleString(),
  });

  const stmt = db.prepare(`
    INSERT INTO scheduled_jobs 
    (from_username, target_usernames, message_variations, schedule_time, campaign_id, status, is_recurring, recurring_interval)
    VALUES (?, ?, ?, datetime(?), ?, ?, ?, ?)
  `);

  try {
    const result = stmt.run(
      fromUsername,
      JSON.stringify(targetUsernames),
      JSON.stringify(messageVariations),
      scheduleDate.toISOString(),
      null, // campaign_id
      "pending",
      isRecurring ? 1 : 0,
      recurringInterval
    );

    console.log(
      "Successfully added scheduled job with ID:",
      result.lastInsertRowid
    );
    return result.lastInsertRowid;
  } catch (error) {
    console.error("Error adding scheduled job:", error);
    throw error;
  }

  return result.lastInsertRowid;
}

function getScheduledJobs() {
  const stmt = db.prepare(
    "SELECT * FROM scheduled_jobs ORDER BY schedule_time ASC"
  );
  return stmt.all();
}

function updateJobStatus(jobId, status) {
  const stmt = db.prepare(
    "UPDATE scheduled_jobs SET status = ?, last_run = CURRENT_TIMESTAMP WHERE id = ?"
  );
  stmt.run(status, jobId);
}

// DM Stats and Logs
function getDMStats(username) {
  const stmt = db.prepare(`
    SELECT *,
    CASE 
      WHEN DATE(last_reset_date) < DATE('now', 'localtime')
      THEN 0
      ELSE daily_dm_count
    END as current_daily_count
    FROM dm_rate_limits 
    WHERE username = ?
  `);
  return (
    stmt.get(username) || { username, daily_dm_count: 0, total_dm_sent: 0 }
  );
}

function logDM(fromUsername, toUsername, success) {
  const stmt = db.prepare(`
    INSERT INTO dm_logs (from_username, to_username, success)
    VALUES (?, ?, ?)
  `);
  stmt.run(fromUsername, toUsername, success ? 1 : 0);
}

// Campaigns
function createCampaign({
  name,
  account_username,
  message_variations,
  target_usernames = [],
  schedule_time,
  is_scheduled = false,
}) {
  const stmt = db.prepare(`
    INSERT INTO campaigns (
      name, 
      account_username, 
      message_variations, 
      target_usernames,
      schedule_time,
      is_scheduled,
      target_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name,
    account_username,
    JSON.stringify(message_variations),
    JSON.stringify(target_usernames),
    schedule_time,
    is_scheduled ? 1 : 0,
    target_usernames.length
  );

  return result.lastInsertRowid;
}

function getCampaigns() {
  const stmt = db.prepare("SELECT * FROM campaigns ORDER BY created_at DESC");
  const campaigns = stmt.all();
  return campaigns.map((campaign) => ({
    ...campaign,
    message_variations: JSON.parse(campaign.message_variations),
    target_usernames: JSON.parse(campaign.target_usernames || "[]"),
    variation_stats: campaign.variation_stats
      ? JSON.parse(campaign.variation_stats)
      : [],
    is_scheduled: Boolean(campaign.is_scheduled),
  }));
}

function updateCampaignStats(campaignId, stats) {
  const stmt = db.prepare(`
    UPDATE campaigns 
    SET 
      success_count = success_count + ?,
      response_count = response_count + ?,
      variation_stats = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(
    stats.success_count || 0,
    stats.response_count || 0,
    JSON.stringify(stats.variation_stats || []),
    campaignId
  );
}

function updateCampaignStatus(id, status) {
  const stmt = db.prepare(`
    UPDATE campaigns 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  stmt.run(status, id);
}

function deleteCampaign(id) {
  const stmt = db.prepare("DELETE FROM campaigns WHERE id = ?");
  stmt.run(id);
}

// Rate Limits
function updateDMRateLimits(username) {
  const stmt = db.prepare(`
    INSERT INTO dm_rate_limits (username, daily_dm_count, last_dm_time, last_reset_date, total_dm_sent)
    VALUES (?, 1, CURRENT_TIMESTAMP, DATE('now', 'localtime'), 1)
    ON CONFLICT(username) DO UPDATE SET
    daily_dm_count = CASE 
      WHEN DATE(last_reset_date) < DATE('now', 'localtime')
      THEN 1
      ELSE daily_dm_count + 1
    END,
    last_dm_time = CURRENT_TIMESTAMP,
    last_reset_date = CASE 
      WHEN DATE(last_reset_date) < DATE('now', 'localtime')
      THEN DATE('now', 'localtime')
      ELSE last_reset_date
    END,
    total_dm_sent = total_dm_sent + 1
  `);
  stmt.run(username);
}

// Alias for updateDMRateLimits to maintain compatibility
const updateDMCount = updateDMRateLimits;

function getPendingJobs() {
  const now = new Date();
  console.log("Querying for pending jobs at:", now.toISOString());
  console.log("Local time:", now.toLocaleString());

  // First, let's see all jobs to debug
  const allJobs = db
    .prepare(`SELECT id, schedule_time, status FROM scheduled_jobs`)
    .all();
  console.log("All jobs in database:", allJobs);

  // Convert schedule_time to Unix timestamp for comparison
  const stmt = db.prepare(`
    SELECT *
    FROM scheduled_jobs 
    WHERE status = 'pending' 
    AND unixepoch(schedule_time) <= unixepoch('now')
    ORDER BY schedule_time ASC
  `);

  const jobs = stmt.all();
  console.log("Pending jobs found:", jobs);

  return jobs.map((job) => ({
    ...job,
    target_usernames: JSON.parse(job.target_usernames || "[]"),
    message_variations: JSON.parse(job.message_variations || "[]"),
  }));
}

// Campaign target management functions
function addCampaignTarget(campaignId, username) {
  const stmt = db.prepare(`
    INSERT INTO campaign_targets (campaign_id, username, status)
    VALUES (?, ?, 'pending')
    ON CONFLICT(campaign_id, username) DO NOTHING
  `);

  const result = stmt.run(campaignId, username);
  return result.changes > 0;
}

function getCampaignTargets(campaignId) {
  const stmt = db.prepare(`
    SELECT id, username, status, created_at, contacted_at
    FROM campaign_targets 
    WHERE campaign_id = ?
    ORDER BY created_at DESC
  `);

  return stmt.all(campaignId);
}

function removeCampaignTarget(campaignId, targetId) {
  const stmt = db.prepare(`
    DELETE FROM campaign_targets 
    WHERE campaign_id = ? AND id = ?
  `);

  const result = stmt.run(campaignId, targetId);
  return result.changes > 0;
}

function updateTargetStatus(campaignId, username, status, contactedAt = null) {
  const stmt = db.prepare(`
    UPDATE campaign_targets 
    SET status = ?, contacted_at = COALESCE(?, contacted_at)
    WHERE campaign_id = ? AND username = ?
  `);

  const result = stmt.run(status, contactedAt, campaignId, username);
  return result.changes > 0;
}

// Campaign replies management
function addCampaignReply(campaignId, username, message, isRead = false) {
  const stmt = db.prepare(`
    INSERT INTO campaign_replies (campaign_id, username, message, is_read, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  const result = stmt.run(campaignId, username, message, isRead ? 1 : 0);
  return result.lastInsertRowid;
}

function getCampaignReplies(campaignId) {
  const stmt = db.prepare(`
    SELECT id, username, message, is_read, created_at
    FROM campaign_replies 
    WHERE campaign_id = ?
    ORDER BY created_at DESC
  `);

  return stmt.all(campaignId);
}

function markReplyAsRead(replyId) {
  const stmt = db.prepare(`
    UPDATE campaign_replies 
    SET is_read = 1
    WHERE id = ?
  `);

  const result = stmt.run(replyId);
  return result.changes > 0;
}

module.exports = {
  addScheduledJob,
  getScheduledJobs,
  updateJobStatus,
  getPendingJobs,
  getDMStats,
  logDM,
  createCampaign,
  getCampaigns,
  updateCampaignStats,
  updateCampaignStatus,
  deleteCampaign,
  updateDMCount,
  scheduleDM: addScheduledJob, // Alias addScheduledJob as scheduleDM for compatibility
  addCampaignTarget,
  getCampaignTargets,
  removeCampaignTarget,
  updateTargetStatus,
  addCampaignReply,
  getCampaignReplies,
  markReplyAsRead,
};
