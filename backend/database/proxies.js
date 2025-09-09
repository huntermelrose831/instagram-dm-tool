const { db, initializeDatabase } = require("./db");
const logger = require("../utils/logger");

const TABLE_NAME = "proxies";

const init = async () => {
  try {
    await initializeDatabase();

    // Create proxies table after main database is initialized
    await new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT,
        password TEXT,
        type TEXT DEFAULT 'http',
        location TEXT,
        is_active BOOLEAN DEFAULT 1,
        response_time REAL,
        success_rate REAL,
        last_checked DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(host, port)
      )`,
        (err) => {
          if (err) {
            logger.error("Proxies table creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    // Create indexes for better performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_proxies_is_active ON ${TABLE_NAME}(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_proxies_type ON ${TABLE_NAME}(type)`,
      `CREATE INDEX IF NOT EXISTS idx_proxies_created_at ON ${TABLE_NAME}(created_at DESC)`,
    ];

    for (const indexSql of indexes) {
      await new Promise((resolve, reject) => {
        db.run(indexSql, (err) => {
          if (err) {
            logger.error("Proxies index creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    logger.info("Proxies table initialized");
  } catch (error) {
    logger.error("Error initializing proxies table:", error);
  }
};

class ProxyService {
  // Create a new proxy
  static async createProxy(proxyData) {
    try {
      const proxy = {
        host: proxyData.host,
        port: proxyData.port,
        username: proxyData.username || null,
        password: proxyData.password || null,
        type: proxyData.type || "http",
        location: proxyData.location || null,
        is_active: proxyData.isActive !== undefined ? proxyData.isActive : true,
        response_time: null,
        success_rate: null,
        last_checked: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = db.run(
        `
        INSERT INTO ${TABLE_NAME} (host, port, username, password, type, location, is_active, response_time, success_rate, last_checked, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          proxy.host,
          proxy.port,
          proxy.username,
          proxy.password,
          proxy.type,
          proxy.location,
          proxy.is_active,
          proxy.response_time,
          proxy.success_rate,
          proxy.last_checked,
          proxy.created_at,
          proxy.updated_at,
        ]
      );

      return result.lastInsertRowid;
    } catch (error) {
      console.error("Error creating proxy:", error);
      throw error;
    }
  }

  // Get all proxies
  static async getProxies(filters = {}) {
    try {
      let query = `SELECT * FROM ${TABLE_NAME}`;
      const conditions = [];
      const params = [];

      if (filters.isActive !== undefined) {
        conditions.push("is_active = ?");
        params.push(filters.isActive ? 1 : 0);
      }

      if (filters.type) {
        conditions.push("type = ?");
        params.push(filters.type);
      }

      if (filters.location) {
        conditions.push("location LIKE ?");
        params.push(`%${filters.location}%`);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " ORDER BY created_at DESC";

      const proxies = db.all(query, params);

      return proxies.map((proxy) => ({
        ...proxy,
        id: proxy.id,
        isActive: proxy.is_active,
      }));
    } catch (error) {
      console.error("Error getting proxies:", error);
      throw error;
    }
  }

  // Get proxy by ID
  static async getProxyById(id) {
    try {
      const proxy = db.get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);

      if (proxy) {
        return {
          ...proxy,
          id: proxy.id,
          isActive: proxy.is_active,
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting proxy by ID:", error);
      throw error;
    }
  }

  // Update proxy status
  static async updateProxyStatus(id, isActive) {
    try {
      db.run(
        `
        UPDATE ${TABLE_NAME}
        SET is_active = ?, updated_at = ?
        WHERE id = ?
      `,
        [isActive ? 1 : 0, new Date().toISOString(), id]
      );

      return true;
    } catch (error) {
      console.error("Error updating proxy status:", error);
      throw error;
    }
  }

  // Update proxy health metrics
  static async updateProxyHealth(id, healthData) {
    try {
      const updateFields = ["updated_at = ?", "last_checked = ?"];
      const values = [new Date().toISOString(), new Date().toISOString()];

      if (healthData.responseTime !== undefined) {
        updateFields.push("response_time = ?");
        values.push(healthData.responseTime);
      }

      if (healthData.successRate !== undefined) {
        updateFields.push("success_rate = ?");
        values.push(healthData.successRate);
      }

      if (healthData.isActive !== undefined) {
        updateFields.push("is_active = ?");
        values.push(healthData.isActive ? 1 : 0);
      }

      values.push(id);

      db.run(
        `
        UPDATE ${TABLE_NAME}
        SET ${updateFields.join(", ")}
        WHERE id = ?
      `,
        values
      );

      return true;
    } catch (error) {
      console.error("Error updating proxy health:", error);
      throw error;
    }
  }

  // Delete proxy
  static async deleteProxy(id) {
    try {
      db.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
      return true;
    } catch (error) {
      console.error("Error deleting proxy:", error);
      throw error;
    }
  }

  // Get proxy statistics
  static async getProxyStats() {
    try {
      const stats = db.get(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
          AVG(response_time) as avg_response_time,
          AVG(success_rate) as avg_success_rate
        FROM ${TABLE_NAME}
      `);

      return {
        total: stats.total || 0,
        active: stats.active || 0,
        avg_response_time: stats.avg_response_time,
        avg_success_rate: stats.avg_success_rate,
      };
    } catch (error) {
      console.error("Error getting proxy stats:", error);
      throw error;
    }
  }

  // Get available proxies for assignment
  static async getAvailableProxies() {
    try {
      // Simplified version - SQLite doesn't have JOINs as complex as MongoDB
      const proxies = db.all(`
        SELECT * FROM ${TABLE_NAME}
        WHERE is_active = 1
        ORDER BY success_rate DESC, created_at ASC
      `);

      return proxies.map((proxy) => ({
        ...proxy,
        id: proxy.id,
        isActive: proxy.is_active,
        assignedAccounts: 0, // Simplified - would need JOIN with accounts table
      }));
    } catch (error) {
      console.error("Error getting available proxies:", error);
      throw error;
    }
  }

  // Test proxy connection (placeholder for actual implementation)
  static async testProxy(id) {
    try {
      const proxy = await this.getProxyById(id);
      if (!proxy) {
        return { success: false, error: "Proxy not found" };
      }

      // Mock test results
      const responseTime = Math.random() * 1000 + 100; // 100-1100ms
      const successRate = Math.random() * 30 + 70; // 70-100%

      // Update proxy health
      await this.updateProxyHealth(id, {
        responseTime: Math.round(responseTime),
        successRate: Math.round(successRate * 10) / 10,
        isActive: successRate > 80,
      });

      return {
        success: successRate > 80,
        responseTime: Math.round(responseTime),
        successRate: Math.round(successRate * 10) / 10,
      };
    } catch (error) {
      console.error("Error testing proxy:", error);
      throw error;
    }
  }

  // Get proxy usage statistics
  static async getProxyUsage(id) {
    try {
      const proxy = await this.getProxyById(id);
      if (!proxy) return null;

      // Simplified - would need JOIN with accounts table in full implementation
      return {
        ...proxy,
        accountsUsing: 0, // Simplified
      };
    } catch (error) {
      console.error("Error getting proxy usage:", error);
      throw error;
    }
  }

  // Alias for backward compatibility
  static async getAllProxies() {
    return this.getProxies();
  }
}

// Initialize on module load
init().catch((err) => {
  logger.error("Failed to initialize proxies:", err);
});

module.exports = ProxyService;
