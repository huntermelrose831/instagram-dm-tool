const db = require("./db");

function updateAccountLimits(username, { dailyLimit, hourlyLimit } = {}) {
  const stmt = db.prepare(`
        INSERT INTO account_limits (username, daily_limit, hourly_limit)
        VALUES (?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET
            daily_limit = COALESCE(?, daily_limit),
            hourly_limit = COALESCE(?, hourly_limit),
            updated_at = CURRENT_TIMESTAMP
    `);
  return stmt.run(username, dailyLimit, hourlyLimit, dailyLimit, hourlyLimit);
}

function checkMessageLimits(username) {
  const stmt = db.prepare(`
        SELECT 
            username,
            daily_limit,
            hourly_limit,
            messages_sent_today,
            messages_sent_hour,
            cooldown_until,
            is_active
        FROM account_limits
        WHERE username = ?
    `);

  const limits = stmt.get(username);

  if (!limits) {
    return { canSend: false, reason: "Account not configured" };
  }

  if (!limits.is_active) {
    return { canSend: false, reason: "Account is inactive" };
  }

  const now = new Date();
  if (limits.cooldown_until && new Date(limits.cooldown_until) > now) {
    return {
      canSend: false,
      reason: "Account in cooldown",
      nextAvailable: limits.cooldown_until,
    };
  }

  if (limits.messages_sent_today >= limits.daily_limit) {
    return {
      canSend: false,
      reason: "Daily limit reached",
      nextAvailable: new Date(now.setHours(24, 0, 0, 0)),
    };
  }

  if (limits.messages_sent_hour >= limits.hourly_limit) {
    return {
      canSend: false,
      reason: "Hourly limit reached",
      nextAvailable: new Date(now.setMinutes(60, 0, 0)),
    };
  }

  return { canSend: true };
}

function recordMessage(username) {
  const stmt = db.prepare(`
        UPDATE account_limits
        SET 
            messages_sent_today = CASE 
                WHEN date(last_message_time) < date('now') 
                THEN 1 
                ELSE messages_sent_today + 1 
            END,
            messages_sent_hour = CASE 
                WHEN datetime(last_message_time) < datetime('now', '-1 hour') 
                THEN 1 
                ELSE messages_sent_hour + 1 
            END,
            last_message_time = CURRENT_TIMESTAMP
        WHERE username = ?
    `);
  return stmt.run(username);
}

function applyCooldown(username, minutes) {
  const stmt = db.prepare(`
        UPDATE account_limits
        SET cooldown_until = datetime('now', '+' || ? || ' minutes')
        WHERE username = ?
    `);
  return stmt.run(minutes, username);
}

function resetDailyCounters() {
  const stmt = db.prepare(`
        UPDATE account_limits
        SET 
            messages_sent_today = 0,
            messages_sent_hour = 0
        WHERE date(last_message_time) < date('now')
    `);
  return stmt.run();
}

function resetHourlyCounters() {
  const stmt = db.prepare(`
        UPDATE account_limits
        SET messages_sent_hour = 0
        WHERE datetime(last_message_time) < datetime('now', '-1 hour')
    `);
  return stmt.run();
}

// Enhanced rate limiting service
class RateLimitService {
  // Get all rate limits
  static getAllRateLimits() {
    const stmt = db.prepare(`
      SELECT 
        al.*,
        ia.id as accountId,
        ia.username as accountUsername
      FROM account_limits al
      LEFT JOIN instagram_accounts ia ON al.username = ia.username
      ORDER BY al.username
    `);

    const limits = stmt.all();

    return limits.map((limit) => ({
      id: limit.id,
      accountId: limit.accountId,
      accountUsername: limit.accountUsername || limit.username,
      dmPerHour: limit.hourly_limit || 10,
      dmPerDay: limit.daily_limit || 100,
      followPerHour: limit.follow_per_hour || 20,
      followPerDay: limit.follow_per_day || 200,
      isActive: !!limit.is_active,
      dailyUsagePercent:
        limit.daily_limit > 0
          ? Math.round((limit.messages_sent_today / limit.daily_limit) * 100)
          : 0,
      hourlyUsagePercent:
        limit.hourly_limit > 0
          ? Math.round((limit.messages_sent_hour / limit.hourly_limit) * 100)
          : 0,
    }));
  }

  // Get rate limit for specific account
  static getRateLimit(username) {
    const stmt = db.prepare(`
      SELECT * FROM account_limits WHERE username = ?
    `);

    const limit = stmt.get(username);

    if (limit) {
      return {
        ...limit,
        isActive: !!limit.is_active,
        dailyUsagePercent:
          limit.daily_limit > 0
            ? Math.round((limit.messages_sent_today / limit.daily_limit) * 100)
            : 0,
        hourlyUsagePercent:
          limit.hourly_limit > 0
            ? Math.round((limit.messages_sent_hour / limit.hourly_limit) * 100)
            : 0,
      };
    }

    return null;
  }

  // Get accounts in cooldown
  static getAccountsInCooldown() {
    const stmt = db.prepare(`
      SELECT * FROM account_limits 
      WHERE cooldown_until IS NOT NULL 
      AND datetime(cooldown_until) > CURRENT_TIMESTAMP
      ORDER BY cooldown_until DESC
    `);

    const accounts = stmt.all();

    return accounts.map((account) => ({
      ...account,
      isActive: !!account.is_active,
      cooldownRemaining:
        account.cooldown_until !== null
          ? Math.max(0, new Date(account.cooldown_until) - new Date())
          : 0,
    }));
  }

  // Get rate limit statistics
  static getRateLimitStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_accounts,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_accounts,
        SUM(CASE WHEN cooldown_until IS NOT NULL AND datetime(cooldown_until) > CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as accounts_in_cooldown,
        AVG(messages_sent_today) as avg_daily_usage,
        AVG(messages_sent_hour) as avg_hourly_usage,
        AVG(daily_limit) as avg_daily_limit,
        AVG(hourly_limit) as avg_hourly_limit
      FROM account_limits
    `);

    return stmt.get();
  }

  // Get accounts near limits
  static getAccountsNearLimits(threshold = 80) {
    const stmt = db.prepare(`
      SELECT 
        *,
        ROUND((messages_sent_today * 100.0 / daily_limit), 1) as daily_usage_percent,
        ROUND((messages_sent_hour * 100.0 / hourly_limit), 1) as hourly_usage_percent
      FROM account_limits 
      WHERE is_active = 1
      AND (
        (messages_sent_today * 100.0 / daily_limit) >= ? OR
        (messages_sent_hour * 100.0 / hourly_limit) >= ?
      )
      ORDER BY daily_usage_percent DESC, hourly_usage_percent DESC
    `);

    const accounts = stmt.all(threshold, threshold);

    return accounts.map((account) => ({
      ...account,
      isActive: !!account.is_active,
    }));
  }

  // Toggle account active status
  static toggleAccountStatus(username) {
    const stmt = db.prepare(`
      UPDATE account_limits 
      SET 
        is_active = NOT is_active,
        updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `);

    const info = stmt.run(username);
    return info.changes > 0;
  }

  // Clear account cooldown
  static clearCooldown(username) {
    const stmt = db.prepare(`
      UPDATE account_limits 
      SET 
        cooldown_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `);

    const info = stmt.run(username);
    return info.changes > 0;
  }

  // Create new rate limit
  static createRateLimit(rateLimitData) {
    // Generate a unique ID based on timestamp and random number
    const generatedId = Date.now() + Math.floor(Math.random() * 1000);
    
    const stmt = db.prepare(`
      INSERT INTO account_limits (
        username, 
        daily_limit, 
        hourly_limit, 
        follow_per_hour,
        follow_per_day,
        is_active,
        id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      rateLimitData.username,
      rateLimitData.dmPerDay || 100,
      rateLimitData.dmPerHour || 10,
      rateLimitData.followPerHour || 20,
      rateLimitData.followPerDay || 200,
      rateLimitData.isActive ? 1 : 0,
      generatedId
    );

    return generatedId;
  }

  // Update rate limit
  static updateRateLimit(id, updates) {
    const stmt = db.prepare(`
      UPDATE account_limits 
      SET 
        daily_limit = ?,
        hourly_limit = ?,
        follow_per_hour = ?,
        follow_per_day = ?,
        is_active = ?
      WHERE id = ?
    `);

    const info = stmt.run(
      updates.dmPerDay,
      updates.dmPerHour,
      updates.followPerHour,
      updates.followPerDay,
      updates.isActive ? 1 : 0,
      id
    );

    return info.changes > 0;
  }

  // Delete rate limit
  static deleteRateLimit(id) {
    const stmt = db.prepare(`
      DELETE FROM account_limits WHERE id = ?
    `);

    const info = stmt.run(id);
    return info.changes > 0;
  }

  // Get rate limit by ID
  static getRateLimitById(id) {
    const stmt = db.prepare(`
      SELECT * FROM account_limits WHERE id = ?
    `);

    const limit = stmt.get(id);

    if (limit) {
      return {
        ...limit,
        isActive: !!limit.is_active,
        dmPerDay: limit.daily_limit,
        dmPerHour: limit.hourly_limit,
        followPerHour: limit.follow_per_hour,
        followPerDay: limit.follow_per_day,
      };
    }

    return null;
  }
}

module.exports = {
  updateAccountLimits,
  checkMessageLimits,
  recordMessage,
  applyCooldown,
  resetDailyCounters,
  resetHourlyCounters,
  RateLimitService,
};
