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
        },
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
    const now = new Date().toISOString();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ${TABLE_NAME} (type, account_username, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [
          reportData.type,
          reportData.account_username || null,
          JSON.stringify(reportData.data || {}),
          now,
          now,
        ],
        function (err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            type: reportData.type,
            account_username: reportData.account_username,
            data: reportData.data || {},
            created_at: now,
            updated_at: now,
          });
        },
      );
    });
  },

  // Get all reports
  async getAllReports() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM ${TABLE_NAME} ORDER BY created_at DESC`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(
            (rows || []).map((r) => ({
              ...r,
              data: JSON.parse(r.data || "{}"),
            })),
          );
        },
      );
    });
  },

  // Get report by ID
  async getReportById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve({ ...row, data: JSON.parse(row.data || "{}") });
      });
    });
  },

  // Get reports by type
  async getReportsByType(type) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM ${TABLE_NAME} WHERE type = ? ORDER BY created_at DESC`,
        [type],
        (err, rows) => {
          if (err) return reject(err);
          resolve(
            (rows || []).map((r) => ({
              ...r,
              data: JSON.parse(r.data || "{}"),
            })),
          );
        },
      );
    });
  },

  // Get reports by account
  async getReportsByAccount(accountUsername) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM ${TABLE_NAME} WHERE account_username = ? ORDER BY created_at DESC`,
        [accountUsername],
        (err, rows) => {
          if (err) return reject(err);
          resolve(
            (rows || []).map((r) => ({
              ...r,
              data: JSON.parse(r.data || "{}"),
            })),
          );
        },
      );
    });
  },

  // Update report
  async updateReport(id, updateData) {
    return new Promise((resolve, reject) => {
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
        `UPDATE ${TABLE_NAME} SET ${updateFields.join(", ")} WHERE id = ?`,
        values,
        (err) => {
          if (err) return reject(err);
          resolve(true);
        },
      );
    });
  },

  // Delete report
  async deleteReport(id) {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id], (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  },

  // Get reports within date range
  async getReportsByDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM ${TABLE_NAME} WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`,
        [startDate, endDate],
        (err, rows) => {
          if (err) return reject(err);
          resolve(
            (rows || []).map((r) => ({
              ...r,
              data: JSON.parse(r.data || "{}"),
            })),
          );
        },
      );
    });
  },

  // Get report statistics
  async getReportStats() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT type, COUNT(*) as count, MAX(created_at) as latest FROM ${TABLE_NAME} GROUP BY type`,
        [],
        (err, stats) => {
          if (err) return reject(err);
          db.get(
            `SELECT COUNT(*) as total FROM ${TABLE_NAME}`,
            [],
            (err2, row) => {
              if (err2) return reject(err2);
              resolve({ total: row ? row.total : 0, byType: stats || [] });
            },
          );
        },
      );
    });
  },
};

// Initialize on module load
init().catch((err) => {
  logger.error("Failed to initialize reports:", err);
});

module.exports = ReportsService;
