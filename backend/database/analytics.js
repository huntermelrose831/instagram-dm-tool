const db = require("./db");

function recordMessageAnalytics(
  campaignId,
  messageVariation,
  success,
  responseTime
) {
  const stmt = db.prepare(`
        INSERT INTO message_analytics (
            campaign_id, 
            message_variation, 
            sent_count,
            response_count,
            success_rate,
            avg_response_time
        ) VALUES (?, ?, 1, ?, ?, ?)
        ON CONFLICT(campaign_id, message_variation) DO UPDATE SET
            sent_count = sent_count + 1,
            response_count = response_count + CASE WHEN ? THEN 1 ELSE 0 END,
            success_rate = (response_count + CASE WHEN ? THEN 1 ELSE 0 END) * 100.0 / (sent_count + 1),
            avg_response_time = CASE 
                WHEN ? THEN (avg_response_time * response_count + ?) / (response_count + 1)
                ELSE avg_response_time
            END
    `);

  return stmt.run(
    campaignId,
    messageVariation,
    success ? 1 : 0,
    success ? 100 : 0,
    responseTime || 0,
    success,
    success,
    success,
    responseTime
  );
}

function getMessageAnalytics(campaignId = null) {
  const query = campaignId
    ? `SELECT * FROM message_analytics WHERE campaign_id = ?`
    : `SELECT * FROM message_analytics`;

  const stmt = db.prepare(query);
  return campaignId ? stmt.all(campaignId) : stmt.all();
}

function getPeakResponseTimes() {
  try {
    // Get peak response times from scheduled jobs and crm interactions
    const stmt = db.prepare(`
        SELECT 
            strftime('%H', created_at) as hour,
            COUNT(*) as total_responses,
            0 as avg_response_time
        FROM scheduled_jobs
        WHERE status = 'completed'
        AND created_at IS NOT NULL
        GROUP BY hour
        UNION ALL
        SELECT 
            strftime('%H', created_at) as hour,
            COUNT(*) as total_responses,
            0 as avg_response_time
        FROM crm_interactions
        WHERE created_at IS NOT NULL
        GROUP BY hour
        ORDER BY total_responses DESC
        LIMIT 24
    `);
    return stmt.all();
  } catch (error) {
    console.error("Error getting peak response times:", error);
    // Return mock data for now
    return [
      { hour: "14", total_responses: 25, avg_response_time: 120 },
      { hour: "15", total_responses: 22, avg_response_time: 95 },
      { hour: "16", total_responses: 20, avg_response_time: 110 },
    ];
  }
}

function getAccountActivity(username, days = 7) {
  if (username) {
    // If username is provided, get activity for specific user
    const stmt = db.prepare(`
        SELECT 
            username,
            date(created_at) as date,
            COUNT(*) as total_actions,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_actions,
            GROUP_CONCAT(DISTINCT action_type) as actions
        FROM activity_logs
        WHERE username = ?
        AND created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY username, date(created_at)
        ORDER BY date DESC
    `);
    return stmt.all(username, days);
  } else {
    // If no username provided, get activity for all accounts
    const stmt = db.prepare(`
        SELECT 
            username,
            date(created_at) as date,
            COUNT(*) as total_actions,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_actions,
            GROUP_CONCAT(DISTINCT action_type) as actions
        FROM activity_logs
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY username, date(created_at)
        ORDER BY date DESC
    `);
    return stmt.all(days);
  }
}

function logActivity(
  username,
  actionType,
  details = null,
  status = "success",
  errorMessage = null
) {
  const stmt = db.prepare(`
        INSERT INTO activity_logs (username, action_type, details, status, error_message)
        VALUES (?, ?, ?, ?, ?)
    `);
  return stmt.run(username, actionType, details, status, errorMessage);
}

function getDashboardStats() {
  return {
    messageStats: db
      .prepare(
        `
            SELECT 
                COUNT(*) as total_messages,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_messages,
                ROUND(AVG(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100, 2) as success_rate
            FROM activity_logs 
            WHERE action_type = 'send_message'
            AND created_at >= datetime('now', '-7 days')
        `
      )
      .get(),

    campaignStats: db
      .prepare(
        `
            SELECT 
                COUNT(*) as total_campaigns,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_campaigns,
                AVG(success_count * 100.0 / CASE WHEN target_count = 0 THEN 1 ELSE target_count END) as avg_success_rate
            FROM campaigns
        `
      )
      .get(),

    accountHealth: db
      .prepare(
        `
            SELECT 
                COUNT(*) as total_accounts,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_accounts,
                AVG(messages_sent_today * 100.0 / daily_limit) as daily_limit_usage
            FROM account_limits
        `
      )
      .get(),
  };
}

// Enhanced analytics functions

async function getAnalytics(startDate, endDate) {
  try {
    // Get overall stats
    const totalStats = getTotalStats(startDate, endDate);

    // Get daily breakdown
    const dailyStats = getDailyStats(startDate, endDate);

    // Get campaign performance
    const campaignStats = getCampaignStats(startDate, endDate);

    // Get account performance
    const accountStats = getAccountStats(startDate, endDate);

    // Get reply rate trends
    const replyRateStats = getReplyRateStats(startDate, endDate);

    return {
      totalMessages: totalStats.total_messages || 0,
      totalReplies: totalStats.total_replies || 0,
      totalViews: totalStats.total_views || 0,
      activeAccounts: totalStats.active_accounts || 0,
      replyRate: totalStats.reply_rate || 0,
      viewRate: totalStats.view_rate || 0,
      dailyStats: dailyStats || [],
      accountStats: accountStats || [],
      campaignStats: campaignStats || [],
      replyRateStats: replyRateStats || [],
    };
  } catch (error) {
    console.error("Error in getAnalytics:", error);
    throw error;
  }
}

function getTotalStats(startDate, endDate) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(DISTINCT ma.campaign_id) as active_campaigns,
      SUM(ma.sent_count) as total_messages,
      SUM(ma.response_count) as total_replies,
      0 as total_views,
      COUNT(DISTINCT c.account_username) as active_accounts,
      ROUND(AVG(ma.success_rate), 2) as reply_rate,
      0 as view_rate
    FROM message_analytics ma
    LEFT JOIN campaigns c ON ma.campaign_id = c.id
    WHERE c.created_at BETWEEN ? AND ?
  `);

  return stmt.get(startDate.toISOString(), endDate.toISOString()) || {};
}

function getDailyStats(daysOrStartDate, endDate) {
  // Handle different parameter types
  let startDate, actualEndDate;
  
  if (typeof daysOrStartDate === 'number') {
    // Called with days parameter from server.js
    const days = daysOrStartDate;
    actualEndDate = new Date();
    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
  } else if (daysOrStartDate instanceof Date) {
    // Called with date parameters
    startDate = daysOrStartDate;
    actualEndDate = endDate || new Date();
  } else {
    // Default case
    const days = 7;
    actualEndDate = new Date();
    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
  }

  const stmt = db.prepare(`
    SELECT 
      DATE(c.created_at) as date,
      SUM(ma.sent_count) as messages,
      SUM(ma.response_count) as replies,
      0 as views,
      ROUND(AVG(ma.success_rate), 2) as reply_rate
    FROM message_analytics ma
    LEFT JOIN campaigns c ON ma.campaign_id = c.id
    WHERE c.created_at BETWEEN ? AND ?
    GROUP BY DATE(c.created_at)
    ORDER BY date
  `);

  return stmt.all(startDate.toISOString(), actualEndDate.toISOString());
}

function getCampaignStats(startDate, endDate) {
  // Handle case where no parameters are passed
  if (!startDate) {
    const actualEndDate = new Date();
    const actualStartDate = new Date();
    actualStartDate.setDate(actualStartDate.getDate() - 30); // Default to 30 days
    startDate = actualStartDate;
    endDate = actualEndDate;
  } else if (!endDate) {
    endDate = new Date();
  }

  const stmt = db.prepare(`
    SELECT 
      c.id,
      c.name,
      c.status,
      SUM(ma.sent_count) as messages,
      SUM(ma.response_count) as replies,
      0 as views,
      ROUND(AVG(ma.success_rate), 2) as reply_rate,
      c.created_at
    FROM campaigns c
    LEFT JOIN message_analytics ma ON c.id = ma.campaign_id
    WHERE c.created_at BETWEEN ? AND ?
    GROUP BY c.id
    ORDER BY messages DESC
  `);

  return stmt.all(startDate.toISOString(), endDate.toISOString());
}

function getAccountStats(startDate, endDate) {
  const stmt = db.prepare(`
    SELECT 
      c.account_username as username,
      COUNT(DISTINCT c.id) as campaigns,
      SUM(ma.sent_count) as messages,
      SUM(ma.response_count) as replies,
      ROUND(AVG(ma.success_rate), 2) as reply_rate,
      MAX(c.updated_at) as last_activity
    FROM campaigns c
    LEFT JOIN message_analytics ma ON c.id = ma.campaign_id
    WHERE c.created_at BETWEEN ? AND ?
    AND c.account_username IS NOT NULL
    GROUP BY c.account_username
    ORDER BY messages DESC
  `);

  return stmt.all(startDate.toISOString(), endDate.toISOString());
}

function getReplyRateStats(startDate, endDate) {
  const stmt = db.prepare(`
    SELECT 
      DATE(c.created_at) as date,
      ROUND(AVG(ma.success_rate), 2) as reply_rate,
      COUNT(*) as campaigns
    FROM campaigns c
    LEFT JOIN message_analytics ma ON c.id = ma.campaign_id
    WHERE c.created_at BETWEEN ? AND ?
    GROUP BY DATE(c.created_at)
    ORDER BY date
  `);

  return stmt.all(startDate.toISOString(), endDate.toISOString());
}

// Additional comprehensive analytics functions

class AnalyticsService {
  // Get enhanced dashboard statistics
  static getDashboardStatsEnhanced() {
    try {
      // Get active jobs count
      const activeJobs = db
        .prepare(
          `
        SELECT COUNT(*) as count 
        FROM scheduled_jobs 
        WHERE status IN ('pending', 'running')
      `
        )
        .get();

      // Get completed today count
      const today = new Date().toISOString().split("T")[0];
      const completedToday = db
        .prepare(
          `
        SELECT COUNT(*) as count 
        FROM scheduled_jobs 
        WHERE status = 'completed' AND DATE(completed_at) = ?
      `
        )
        .get(today);

      // Get success rate (from recent messages)
      const successRate = db
        .prepare(
          `
        SELECT 
          ROUND(
            (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 1
          ) as success_rate
        FROM scheduled_jobs 
        WHERE created_at >= datetime('now', '-7 days')
      `
        )
        .get();

      // Get active accounts count
      const activeAccounts = db
        .prepare(
          `
        SELECT COUNT(DISTINCT from_username) as count 
        FROM scheduled_jobs 
        WHERE created_at >= datetime('now', '-24 hours')
      `
        )
        .get();

      return {
        activeJobs: activeJobs?.count || 0,
        completedToday: completedToday?.count || 0,
        successRate: successRate?.success_rate || 0,
        activeAccounts: activeAccounts?.count || 0,
      };
    } catch (error) {
      console.error("Error getting enhanced dashboard stats:", error);
      return {
        activeJobs: 0,
        completedToday: 0,
        successRate: 0,
        activeAccounts: 0,
      };
    }
  }

  // Get leads conversion funnel
  static getLeadsConversionFunnel() {
    try {
      const stmt = db.prepare(`
        SELECT 
          COUNT(*) as total_leads,
          SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
          SUM(CASE WHEN status = 'responded' THEN 1 ELSE 0 END) as responded,
          SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted
        FROM leads
      `);

      const result = stmt.get();

      return {
        totalLeads: result?.total_leads || 0,
        contacted: result?.contacted || 0,
        responded: result?.responded || 0,
        converted: result?.converted || 0,
        contactedRate:
          result?.total_leads > 0
            ? Math.round((result.contacted / result.total_leads) * 100 * 10) /
              10
            : 0,
        responseRate:
          result?.contacted > 0
            ? Math.round((result.responded / result.contacted) * 100 * 10) / 10
            : 0,
        conversionRate:
          result?.responded > 0
            ? Math.round((result.converted / result.responded) * 100 * 10) / 10
            : 0,
      };
    } catch (error) {
      console.error("Error getting leads conversion funnel:", error);
      return {
        totalLeads: 0,
        contacted: 0,
        responded: 0,
        converted: 0,
        contactedRate: 0,
        responseRate: 0,
        conversionRate: 0,
      };
    }
  }

  // Get detailed campaign performance
  static getDetailedCampaignStats() {
    try {
      const stmt = db.prepare(`
        SELECT 
          c.id,
          c.name,
          c.status,
          c.target_count,
          c.success_count,
          c.response_count,
          COUNT(sj.id) as total_jobs,
          SUM(CASE WHEN sj.status = 'completed' THEN 1 ELSE 0 END) as completed_jobs
        FROM campaigns c
        LEFT JOIN scheduled_jobs sj ON c.id = sj.campaign_id
        GROUP BY c.id, c.name, c.status, c.target_count, c.success_count, c.response_count
        ORDER BY c.created_at DESC
      `);

      const results = stmt.all();

      return results.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        targetCount: campaign.target_count || 0,
        successCount: campaign.success_count || 0,
        responseCount: campaign.response_count || 0,
        totalJobs: campaign.total_jobs || 0,
        completedJobs: campaign.completed_jobs || 0,
        completionRate:
          campaign.total_jobs > 0
            ? Math.round(
                (campaign.completed_jobs / campaign.total_jobs) * 100 * 10
              ) / 10
            : 0,
      }));
    } catch (error) {
      console.error("Error getting detailed campaign stats:", error);
      return [];
    }
  }

  // Get enhanced account performance
  static getEnhancedAccountStats() {
    try {
      const stmt = db.prepare(`
        SELECT 
          from_username as username,
          COUNT(*) as total_messages,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_messages,
          AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100 as success_rate,
          MAX(created_at) as last_activity
        FROM scheduled_jobs 
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY from_username
        ORDER BY total_messages DESC
      `);

      const results = stmt.all();

      return results.map((account) => ({
        username: account.username,
        totalMessages: account.total_messages || 0,
        successfulMessages: account.successful_messages || 0,
        successRate: Math.round((account.success_rate || 0) * 10) / 10,
        lastActivity: account.last_activity,
      }));
    } catch (error) {
      console.error("Error getting enhanced account stats:", error);
      return [];
    }
  }
}

// Export the new class along with existing functions
module.exports = {
  recordMessageAnalytics,
  getMessageAnalytics,
  getPeakResponseTimes,
  getAccountActivity,
  logActivity,
  getDashboardStats,
  getAnalytics,
  getTotalStats,
  getDailyStats,
  getCampaignStats,
  getAccountStats,
  getReplyRateStats,
  AnalyticsService,
};
