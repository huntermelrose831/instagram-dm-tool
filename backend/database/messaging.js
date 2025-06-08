const { db } = require("./index");

// Scheduled Jobs
function addScheduledJob({
  fromUsername,
  targetUsernames,
  messageVariations,
  scheduleTime,
  isRecurring,
  recurringInterval,
}) {
  const stmt = db.prepare(`
    INSERT INTO scheduled_jobs 
    (from_username, target_usernames, message_variations, schedule_time, is_recurring, recurring_interval)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    fromUsername,
    JSON.stringify(targetUsernames),
    JSON.stringify(messageVariations),
    scheduleTime,
    isRecurring ? 1 : 0,
    recurringInterval
  );

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

module.exports = {
  addScheduledJob,
  getScheduledJobs,
  updateJobStatus,
  getDMStats,
  logDM,
  createCampaign,
  getCampaigns,
  updateCampaignStats,
  updateCampaignStatus,
  deleteCampaign,
  updateDMRateLimits,
};
