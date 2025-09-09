const { db, initializeDatabase } = require("./db");
const logger = require("../utils/logger");

const TABLE_NAME = "account_limits";

const init = async () => {
  try {
    await initializeDatabase();

    // Create account_limits table after main database is initialized
    await new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        daily_limit INTEGER DEFAULT 100,
        hourly_limit INTEGER DEFAULT 10,
        follow_per_hour INTEGER DEFAULT 20,
        follow_per_day INTEGER DEFAULT 200,
        is_active BOOLEAN DEFAULT 1,
        messages_sent_today INTEGER DEFAULT 0,
        messages_sent_hour INTEGER DEFAULT 0,
        last_message_time DATETIME,
        cooldown_until DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
        (err) => {
          if (err) {
            logger.error("Account limits table creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    // Create indexes for better performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_account_limits_username ON ${TABLE_NAME}(username)`,
      `CREATE INDEX IF NOT EXISTS idx_account_limits_is_active ON ${TABLE_NAME}(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_account_limits_cooldown_until ON ${TABLE_NAME}(cooldown_until)`,
      `CREATE INDEX IF NOT EXISTS idx_account_limits_last_message_time ON ${TABLE_NAME}(last_message_time DESC)`,
    ];

    for (const indexSql of indexes) {
      await new Promise((resolve, reject) => {
        db.run(indexSql, (err) => {
          if (err) {
            logger.error("Account limits index creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    logger.info("Account limits table initialized");
  } catch (error) {
    logger.error("Error initializing account limits table:", error);
  }
};

async function updateAccountLimits(username, { dailyLimit, hourlyLimit } = {}) {
  try {
    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (dailyLimit !== undefined) {
      updateData.daily_limit = dailyLimit;
    }

    if (hourlyLimit !== undefined) {
      updateData.hourly_limit = hourlyLimit;
    }

    // Check if record exists
    const existing = db.get(`SELECT id FROM ${TABLE_NAME} WHERE username = ?`, [
      username,
    ]);

    if (existing) {
      // Update existing record
      const fields = Object.keys(updateData)
        .map((key) => `${key} = ?`)
        .join(", ");
      const values = Object.values(updateData);
      values.push(username);

      db.run(`UPDATE ${TABLE_NAME} SET ${fields} WHERE username = ?`, values);
    } else {
      // Insert new record
      const newRecord = {
        username,
        daily_limit: dailyLimit || 100,
        hourly_limit: hourlyLimit || 10,
        messages_sent_today: 0,
        messages_sent_hour: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        ...updateData,
      };

      const fields = Object.keys(newRecord).join(", ");
      const placeholders = Object.keys(newRecord)
        .map(() => "?")
        .join(", ");
      const values = Object.values(newRecord);

      db.run(
        `INSERT INTO ${TABLE_NAME} (${fields}) VALUES (${placeholders})`,
        values
      );
    }

    return { acknowledged: true };
  } catch (error) {
    console.error("Error updating account limits:", error);
    throw error;
  }
}

async function checkMessageLimits(username) {
  try {
    const limits = db.get(`SELECT * FROM ${TABLE_NAME} WHERE username = ?`, [
      username,
    ]);

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
        nextAvailable: new Date(now.setHours(24, 0, 0, 0)).toISOString(),
      };
    }

    if (limits.messages_sent_hour >= limits.hourly_limit) {
      return {
        canSend: false,
        reason: "Hourly limit reached",
        nextAvailable: new Date(now.setMinutes(60, 0, 0)).toISOString(),
      };
    }

    return { canSend: true };
  } catch (error) {
    console.error("Error checking message limits:", error);
    throw error;
  }
}

async function recordMessage(username) {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const limits = db.get(`SELECT * FROM ${TABLE_NAME} WHERE username = ?`, [
      username,
    ]);

    if (!limits) {
      throw new Error("Account limits not found");
    }

    let messagesToday = limits.messages_sent_today || 0;
    let messagesHour = limits.messages_sent_hour || 0;

    // Reset daily counter if it's a new day
    if (
      !limits.last_message_time ||
      new Date(limits.last_message_time) < today
    ) {
      messagesToday = 0;
    }

    // Reset hourly counter if more than an hour has passed
    if (
      !limits.last_message_time ||
      new Date(limits.last_message_time) < oneHourAgo
    ) {
      messagesHour = 0;
    }

    db.run(
      `
      UPDATE ${TABLE_NAME}
      SET messages_sent_today = ?, messages_sent_hour = ?, last_message_time = ?, updated_at = ?
      WHERE username = ?
    `,
      [
        messagesToday + 1,
        messagesHour + 1,
        now.toISOString(),
        now.toISOString(),
        username,
      ]
    );

    return { acknowledged: true };
  } catch (error) {
    console.error("Error recording message:", error);
    throw error;
  }
}

async function applyCooldown(username, minutes) {
  try {
    const cooldownUntil = new Date(Date.now() + minutes * 60 * 1000);

    db.run(
      `
      UPDATE ${TABLE_NAME}
      SET cooldown_until = ?, updated_at = ?
      WHERE username = ?
    `,
      [cooldownUntil.toISOString(), new Date().toISOString(), username]
    );

    return { acknowledged: true };
  } catch (error) {
    console.error("Error applying cooldown:", error);
    throw error;
  }
}

async function resetDailyCounters() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    db.run(
      `
      UPDATE ${TABLE_NAME}
      SET messages_sent_today = 0, messages_sent_hour = 0, updated_at = ?
      WHERE last_message_time < ? OR last_message_time IS NULL
    `,
      [new Date().toISOString(), today.toISOString()]
    );

    return { acknowledged: true };
  } catch (error) {
    console.error("Error resetting daily counters:", error);
    throw error;
  }
}

async function resetHourlyCounters() {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    db.run(
      `
      UPDATE ${TABLE_NAME}
      SET messages_sent_hour = 0, updated_at = ?
      WHERE last_message_time < ? OR last_message_time IS NULL
    `,
      [new Date().toISOString(), oneHourAgo.toISOString()]
    );

    return { acknowledged: true };
  } catch (error) {
    console.error("Error resetting hourly counters:", error);
    throw error;
  }
}

// Enhanced rate limiting service
class RateLimitService {
  // Get all rate limits
  static async getAllRateLimits() {
    try {
      const limits = db.all(`
        SELECT * FROM ${TABLE_NAME}
        ORDER BY username
      `);

      return limits.map((limit) => {
        const dailyUsagePercent =
          limit.daily_limit > 0
            ? Math.round((limit.messages_sent_today / limit.daily_limit) * 100)
            : 0;

        const hourlyUsagePercent =
          limit.hourly_limit > 0
            ? Math.round((limit.messages_sent_hour / limit.hourly_limit) * 100)
            : 0;

        return {
          id: limit.id,
          accountId: limit.id, // Simplified
          accountUsername: limit.username,
          dmPerHour: limit.hourly_limit || 10,
          dmPerDay: limit.daily_limit || 100,
          followPerHour: limit.follow_per_hour || 20,
          followPerDay: limit.follow_per_day || 200,
          isActive: !!limit.is_active,
          dailyUsagePercent,
          hourlyUsagePercent,
        };
      });
    } catch (error) {
      console.error("Error getting all rate limits:", error);
      throw error;
    }
  }

  // Get rate limit for specific account
  static async getRateLimit(username) {
    try {
      const limit = db.get(`SELECT * FROM ${TABLE_NAME} WHERE username = ?`, [
        username,
      ]);

      if (limit) {
        const dailyUsagePercent =
          limit.daily_limit > 0
            ? Math.round((limit.messages_sent_today / limit.daily_limit) * 100)
            : 0;

        const hourlyUsagePercent =
          limit.hourly_limit > 0
            ? Math.round((limit.messages_sent_hour / limit.hourly_limit) * 100)
            : 0;

        return {
          ...limit,
          id: limit.id,
          isActive: !!limit.is_active,
          dailyUsagePercent,
          hourlyUsagePercent,
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting rate limit:", error);
      throw error;
    }
  }

  // Get accounts in cooldown
  static async getAccountsInCooldown() {
    try {
      const now = new Date();
      const accounts = db.all(
        `
        SELECT * FROM ${TABLE_NAME}
        WHERE cooldown_until IS NOT NULL AND cooldown_until > ?
        ORDER BY cooldown_until DESC
      `,
        [now.toISOString()]
      );

      return accounts.map((account) => ({
        ...account,
        id: account.id,
        isActive: !!account.is_active,
        cooldownRemaining: account.cooldown_until
          ? Math.max(
              0,
              new Date(account.cooldown_until).getTime() - now.getTime()
            )
          : 0,
      }));
    } catch (error) {
      console.error("Error getting accounts in cooldown:", error);
      throw error;
    }
  }

  // Get rate limit statistics
  static async getRateLimitStats() {
    try {
      const stats = db.get(`
        SELECT
          COUNT(*) as total_accounts,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_accounts,
          AVG(messages_sent_today) as avg_daily_usage,
          AVG(messages_sent_hour) as avg_hourly_usage,
          AVG(daily_limit) as avg_daily_limit,
          AVG(hourly_limit) as avg_hourly_limit
        FROM ${TABLE_NAME}
      `);

      const now = new Date();
      const cooldownCount = db.get(
        `
        SELECT COUNT(*) as count FROM ${TABLE_NAME}
        WHERE cooldown_until IS NOT NULL AND cooldown_until > ?
      `,
        [now.toISOString()]
      );

      return {
        total_accounts: stats.total_accounts || 0,
        active_accounts: stats.active_accounts || 0,
        accounts_in_cooldown: cooldownCount.count || 0,
        avg_daily_usage: stats.avg_daily_usage || 0,
        avg_hourly_usage: stats.avg_hourly_usage || 0,
        avg_daily_limit: stats.avg_daily_limit || 0,
        avg_hourly_limit: stats.avg_hourly_limit || 0,
      };
    } catch (error) {
      console.error("Error getting rate limit stats:", error);
      throw error;
    }
  }

  // Get accounts near limits
  static async getAccountsNearLimits(threshold = 80) {
    try {
      const accounts = db.all(
        `
        SELECT *,
          (messages_sent_today * 100.0 / daily_limit) as daily_usage_percent,
          (messages_sent_hour * 100.0 / hourly_limit) as hourly_usage_percent
        FROM ${TABLE_NAME}
        WHERE is_active = 1
          AND (messages_sent_today * 100.0 / daily_limit >= ? OR messages_sent_hour * 100.0 / hourly_limit >= ?)
        ORDER BY daily_usage_percent DESC, hourly_usage_percent DESC
      `,
        [threshold, threshold]
      );

      return accounts.map((account) => ({
        ...account,
        id: account.id,
        isActive: !!account.is_active,
      }));
    } catch (error) {
      console.error("Error getting accounts near limits:", error);
      throw error;
    }
  }

  // Toggle account active status
  static async toggleAccountStatus(username) {
    try {
      const account = db.get(
        `SELECT is_active FROM ${TABLE_NAME} WHERE username = ?`,
        [username]
      );
      if (!account) return false;

      db.run(
        `
        UPDATE ${TABLE_NAME}
        SET is_active = ?, updated_at = ?
        WHERE username = ?
      `,
        [account.is_active ? 0 : 1, new Date().toISOString(), username]
      );

      return true;
    } catch (error) {
      console.error("Error toggling account status:", error);
      throw error;
    }
  }

  // Clear account cooldown
  static async clearCooldown(username) {
    try {
      db.run(
        `
        UPDATE ${TABLE_NAME}
        SET cooldown_until = NULL, updated_at = ?
        WHERE username = ?
      `,
        [new Date().toISOString(), username]
      );

      return true;
    } catch (error) {
      console.error("Error clearing cooldown:", error);
      throw error;
    }
  }

  // Create new rate limit
  static async createRateLimit(rateLimitData) {
    try {
      const rateLimit = {
        username: rateLimitData.username,
        daily_limit: rateLimitData.dmPerDay || 100,
        hourly_limit: rateLimitData.dmPerHour || 10,
        follow_per_hour: rateLimitData.followPerHour || 20,
        follow_per_day: rateLimitData.followPerDay || 200,
        is_active:
          rateLimitData.isActive !== undefined ? rateLimitData.isActive : true,
        messages_sent_today: 0,
        messages_sent_hour: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = db.run(
        `
        INSERT INTO ${TABLE_NAME} (username, daily_limit, hourly_limit, follow_per_hour, follow_per_day, is_active, messages_sent_today, messages_sent_hour, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          rateLimit.username,
          rateLimit.daily_limit,
          rateLimit.hourly_limit,
          rateLimit.follow_per_hour,
          rateLimit.follow_per_day,
          rateLimit.is_active,
          rateLimit.messages_sent_today,
          rateLimit.messages_sent_hour,
          rateLimit.created_at,
          rateLimit.updated_at,
        ]
      );

      return result.lastInsertRowid;
    } catch (error) {
      console.error("Error creating rate limit:", error);
      throw error;
    }
  }

  // Update rate limit
  static async updateRateLimit(id, updates) {
    try {
      const updateData = {
        updated_at: new Date().toISOString(),
      };

      if (updates.dmPerDay !== undefined) {
        updateData.daily_limit = updates.dmPerDay;
      }

      if (updates.dmPerHour !== undefined) {
        updateData.hourly_limit = updates.dmPerHour;
      }

      if (updates.followPerHour !== undefined) {
        updateData.follow_per_hour = updates.followPerHour;
      }

      if (updates.followPerDay !== undefined) {
        updateData.follow_per_day = updates.followPerDay;
      }

      if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
      }

      const fields = Object.keys(updateData)
        .map((key) => `${key} = ?`)
        .join(", ");
      const values = Object.values(updateData);
      values.push(id);

      db.run(`UPDATE ${TABLE_NAME} SET ${fields} WHERE id = ?`, values);

      return true;
    } catch (error) {
      console.error("Error updating rate limit:", error);
      throw error;
    }
  }

  // Delete rate limit
  static async deleteRateLimit(id) {
    try {
      db.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
      return true;
    } catch (error) {
      console.error("Error deleting rate limit:", error);
      throw error;
    }
  }

  // Get rate limit by ID
  static async getRateLimitById(id) {
    try {
      const limit = db.get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);

      if (limit) {
        return {
          ...limit,
          id: limit.id,
          isActive: !!limit.is_active,
          dmPerDay: limit.daily_limit,
          dmPerHour: limit.hourly_limit,
          followPerHour: limit.follow_per_hour,
          followPerDay: limit.follow_per_day,
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting rate limit by ID:", error);
      throw error;
    }
  }
}

// Initialize on module load
init().catch((err) => {
  logger.error("Failed to initialize rate limits:", err);
});

module.exports = {
  updateAccountLimits,
  checkMessageLimits,
  recordMessage,
  applyCooldown,
  resetDailyCounters,
  resetHourlyCounters,
  RateLimitService,
};
