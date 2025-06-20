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
  // BULLETPROOF TIMEZONE FIX: Parse and store as local time, never convert to UTC
  let scheduleDate;
  let sqliteDateTime;

  if (typeof scheduleTime === "string" && scheduleTime.includes("T")) {
    // Handle datetime-local format: "YYYY-MM-DDTHH:MM"
    const [datePart, timePart] = scheduleTime.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);

    // Create Date object using local time components (month is 0-indexed)
    scheduleDate = new Date(year, month - 1, day, hours, minutes);

    // CRITICAL FIX: Format for SQLite as local time, NOT UTC
    // SQLite datetime() function expects: 'YYYY-MM-DD HH:MM:SS'
    const pad = (num) => String(num).padStart(2, "0");
    sqliteDateTime = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:00`;

    console.log("TIMEZONE DEBUG - Parsed datetime-local as LOCAL time:", {
      input: scheduleTime,
      parsedDate: scheduleDate.toString(),
      parsedYear: year,
      parsedMonth: month,
      parsedDay: day,
      parsedHours: hours,
      parsedMinutes: minutes,
      sqliteFormat: sqliteDateTime,
      // Show what toISOString() would give (for comparison)
      isoStringWouldBe: scheduleDate.toISOString(),
      timezoneOffset: scheduleDate.getTimezoneOffset(),
    });
  } else {
    // Fallback for other formats
    scheduleDate = new Date(scheduleTime);
    // Format as local time for SQLite
    const year = scheduleDate.getFullYear();
    const month = scheduleDate.getMonth() + 1;
    const day = scheduleDate.getDate();
    const hours = scheduleDate.getHours();
    const minutes = scheduleDate.getMinutes();
    const pad = (num) => String(num).padStart(2, "0");
    sqliteDateTime = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:00`;

    console.log("Used fallback Date parsing (local time):", {
      input: scheduleTime,
      parsed: scheduleDate.toString(),
      sqliteFormat: sqliteDateTime,
    });
  }
  const stmt = db.prepare(`
    INSERT INTO scheduled_jobs 
    (from_username, target_usernames, message_variations, schedule_time, campaign_id, status, is_recurring, recurring_interval)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    const result = stmt.run(
      fromUsername,
      JSON.stringify(targetUsernames),
      JSON.stringify(messageVariations),
      sqliteDateTime, // Store as local time string, NOT ISO UTC
      null, // campaign_id
      "pending",
      isRecurring ? 1 : 0,
      recurringInterval
    );

    console.log("TIMEZONE DEBUG - Successfully stored in database:", {
      jobId: result.lastInsertRowid,
      storedDateTime: sqliteDateTime,
      originalInput: scheduleTime,
    });
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
  // Try the full update first, fall back to basic update if column doesn't exist
  try {
    const stmt = db.prepare(
      "UPDATE scheduled_jobs SET status = ?, last_run = CURRENT_TIMESTAMP WHERE id = ?"
    );
    stmt.run(status, jobId);
  } catch (error) {
    if (error.message.includes("no such column: last_run")) {
      console.log("last_run column doesn't exist, using basic update");
      const stmt = db.prepare(
        "UPDATE scheduled_jobs SET status = ? WHERE id = ?"
      );
      stmt.run(status, jobId);
    } else {
      throw error;
    }
  }
}

function deleteScheduledJob(jobId) {
  const stmt = db.prepare("DELETE FROM scheduled_jobs WHERE id = ?");
  const result = stmt.run(jobId);

  if (result.changes === 0) {
    throw new Error(`Job with ID ${jobId} not found`);
  }

  console.log(`Successfully deleted job ${jobId}`);
  return result;
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
  console.log(`DEBUG: Updating DM count for username: "${username}"`);

  try {
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

    const result = stmt.run(username);
    console.log(
      `DEBUG: DM count update successful for ${username}, changes: ${result.changes}`
    );
  } catch (error) {
    console.error(
      `DEBUG: DM count update failed for ${username}:`,
      error.message
    );

    // Try to get table info to debug
    try {
      const tableExists = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='dm_rate_limits'`
        )
        .get();
      console.log(`DEBUG: Table exists:`, tableExists);

      if (tableExists) {
        const tableInfo = db.prepare("PRAGMA table_info(dm_rate_limits)").all();
        console.log(
          `DEBUG: Table structure:`,
          tableInfo.map((c) => `${c.name}(pk:${c.pk})`).join(", ")
        );
      }
    } catch (debugError) {
      console.error(`DEBUG: Failed to get table info:`, debugError.message);
    }

    // Don't throw the error - this is not critical for DM sending
    console.warn(
      `Non-critical: Failed to update DM rate limits for ${username}: ${error.message}`
    );
  }
}

// Alias for updateDMRateLimits to maintain compatibility
const updateDMCount = updateDMRateLimits;

function getPendingJobs() {
  const now = new Date();
  console.log("Querying for pending jobs at:", now.toISOString());
  console.log("Local time:", now.toLocaleString());

  // TIMEZONE FIX: Format current time as local time string for comparison
  // This matches the format we use when storing: 'YYYY-MM-DD HH:MM:SS'
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const pad = (num) => String(num).padStart(2, "0");
  const currentLocalTime = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  console.log("Current local time for comparison:", currentLocalTime);

  // First, let's see all jobs to debug
  const allJobs = db
    .prepare(`SELECT id, schedule_time, status FROM scheduled_jobs`)
    .all();
  console.log("All jobs in database:", allJobs);

  // CRITICAL FIX: Compare local time strings directly instead of using unixepoch()
  // Since we store schedule_time as local time strings, we need to compare with local time
  const stmt = db.prepare(`
    SELECT *
    FROM scheduled_jobs 
    WHERE status = 'pending' 
    AND schedule_time <= ?
    ORDER BY schedule_time ASC
  `);

  const jobs = stmt.all(currentLocalTime);
  console.log("TIMEZONE DEBUG - Jobs ready to execute:", {
    currentTime: currentLocalTime,
    jobsFound: jobs.length,
    jobs: jobs.map((j) => ({
      id: j.id,
      schedule_time: j.schedule_time,
      from_username: j.from_username,
    })),
  });

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
function addCampaignReply(
  campaignId,
  username,
  messageContent,
  replyContent,
  sentiment = null,
  isRead = false
) {
  const stmt = db.prepare(`
    INSERT INTO campaign_replies (campaign_id, username, message_content, reply_content, sentiment, is_read, received_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const result = stmt.run(
    campaignId,
    username,
    messageContent,
    replyContent,
    sentiment,
    isRead ? 1 : 0
  );
  return result.lastInsertRowid;
}

function getCampaignReplies(campaignId) {
  const stmt = db.prepare(`
    SELECT id, username, message_content, reply_content, sentiment, is_read, received_at, created_at
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
  updateDMRateLimits,
  deleteScheduledJob,
  scheduleDM: addScheduledJob, // Alias addScheduledJob as scheduleDM for compatibility
  addCampaignTarget,
  getCampaignTargets,
  removeCampaignTarget,
  updateTargetStatus,
  addCampaignReply,
  getCampaignReplies,
  markReplyAsRead,
};
