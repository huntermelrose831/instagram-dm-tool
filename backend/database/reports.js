const { db, initializeDatabase } = require("./db");
const logger = require("../utils/logger");

const TABLE_NAME = "reports";

// Initialize reports table
const init = async () => {
  try {
    await initializeDatabase();

    // Create reports table after main database is initialized
    await new Promise((resolve, reject) => {
      db.run(
        `
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          account_username TEXT,
          data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) {
            logger.error("Reports table creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    // Create indexes for better performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_reports_created_at ON ${TABLE_NAME}(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_reports_type ON ${TABLE_NAME}(type)`,
      `CREATE INDEX IF NOT EXISTS idx_reports_account_username ON ${TABLE_NAME}(account_username)`,
    ];

    for (const indexSql of indexes) {
      await new Promise((resolve, reject) => {
        db.run(indexSql, (err) => {
          if (err) {
            logger.error("Reports index creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    logger.info("Reports table initialized");
  } catch (error) {
    logger.error("Error initializing reports table:", error);
  }
};

const ReportsService = {
  // Create a new report
  async createReport(reportData) {
    try {
      const report = {
        type: reportData.type,
        account_username: reportData.account_username,
        data: JSON.stringify(reportData.data || {}),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = db.run(
        `
        INSERT INTO ${TABLE_NAME} (type, account_username, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
        [
          report.type,
          report.account_username,
          report.data,
          report.created_at,
          report.updated_at,
        ]
      );

      return { id: result.lastInsertRowid, ...report };
    } catch (error) {
      console.error("Error creating report:", error);
      throw error;
    }
  },

  // Get all reports
  async getAllReports() {
    try {
      const reports = db.all(`
        SELECT * FROM ${TABLE_NAME}
        ORDER BY created_at DESC
      `);

      return reports.map((report) => ({
        ...report,
        id: report.id,
        data: JSON.parse(report.data || "{}"),
      }));
    } catch (error) {
      console.error("Error getting all reports:", error);
      throw error;
    }
  },

  // Get report by ID
  async getReportById(id) {
    try {
      const report = db.get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);

      if (report) {
        return {
          ...report,
          id: report.id,
          data: JSON.parse(report.data || "{}"),
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting report by ID:", error);
      throw error;
    }
  },

  // Get reports by type
  async getReportsByType(type) {
    try {
      const reports = db.all(
        `
        SELECT * FROM ${TABLE_NAME}
        WHERE type = ?
        ORDER BY created_at DESC
      `,
        [type]
      );

      return reports.map((report) => ({
        ...report,
        id: report.id,
        data: JSON.parse(report.data || "{}"),
      }));
    } catch (error) {
      console.error("Error getting reports by type:", error);
      throw error;
    }
  },

  // Get reports by account
  async getReportsByAccount(accountUsername) {
    try {
      const reports = db.all(
        `
        SELECT * FROM ${TABLE_NAME}
        WHERE account_username = ?
        ORDER BY created_at DESC
      `,
        [accountUsername]
      );

      return reports.map((report) => ({
        ...report,
        id: report.id,
        data: JSON.parse(report.data || "{}"),
      }));
    } catch (error) {
      console.error("Error getting reports by account:", error);
      throw error;
    }
  },

  // Update report
  async updateReport(id, updateData) {
    try {
      const updateFields = ["updated_at = ?"];
      const values = [new Date().toISOString()];

      if (updateData.type !== undefined) {
        updateFields.push("type = ?");
        values.push(updateData.type);
      }

      if (updateData.account_username !== undefined) {
        updateFields.push("account_username = ?");
        values.push(updateData.account_username);
      }

      if (updateData.data !== undefined) {
        updateFields.push("data = ?");
        values.push(JSON.stringify(updateData.data));
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
      console.error("Error updating report:", error);
      throw error;
    }
  },

  // Delete report
  async deleteReport(id) {
    try {
      db.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
      return true;
    } catch (error) {
      console.error("Error deleting report:", error);
      throw error;
    }
  },

  // Get reports within date range
  async getReportsByDateRange(startDate, endDate) {
    try {
      const reports = db.all(
        `
        SELECT * FROM ${TABLE_NAME}
        WHERE created_at >= ? AND created_at <= ?
        ORDER BY created_at DESC
      `,
        [startDate, endDate]
      );

      return reports.map((report) => ({
        ...report,
        id: report.id,
        data: JSON.parse(report.data || "{}"),
      }));
    } catch (error) {
      console.error("Error getting reports by date range:", error);
      throw error;
    }
  },

  // Get report statistics
  async getReportStats() {
    try {
      const stats = db.all(`
        SELECT type, COUNT(*) as count, MAX(created_at) as latest
        FROM ${TABLE_NAME}
        GROUP BY type
      `);

      const totalReports = db.get(
        `SELECT COUNT(*) as total FROM ${TABLE_NAME}`
      ).total;

      return {
        total: totalReports,
        byType: stats,
      };
    } catch (error) {
      console.error("Error getting report stats:", error);
      throw error;
    }
  },
};

// Initialize on module load
init().catch((err) => {
  logger.error("Failed to initialize reports:", err);
});

module.exports = ReportsService;
