const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

// Database file path - use DATA_DIR if provided, otherwise use current working directory
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "instagram-dm-tool.db");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
let db = null;
let isInitialized = false;

const initializeDatabase = () => {
  if (isInitialized) return Promise.resolve();

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error("Database initialization failed:", err);
        reject(err);
        return;
      }

      // Create tables synchronously to ensure proper order
      const tables = [
        `CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          email TEXT,
          password TEXT,
          cookies TEXT,
          status TEXT DEFAULT 'active',
          last_login DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS leads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          full_name TEXT,
          profile_url TEXT,
          status TEXT DEFAULT 'new',
          source TEXT,
          is_target BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER,
          content TEXT,
          status TEXT DEFAULT 'pending',
          sent_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (lead_id) REFERENCES leads (id)
        )`,
        `CREATE TABLE IF NOT EXISTS scheduled_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT,
          data TEXT,
          scheduled_at DATETIME,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS targets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          source TEXT DEFAULT 'manual',
          is_target BOOLEAN DEFAULT 1,
          added_to_targets BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      ];

      // Create tables synchronously in series to avoid race conditions
      let completed = 0;
      const total = tables.length;

      tables.forEach((sql, index) => {
        db.run(sql, (err) => {
          if (err) {
            logger.error(`Table creation failed for table ${index}:`, err);
            reject(err);
            return;
          }

          completed++;
          if (completed === total) {
            isInitialized = true;
            logger.info("Database initialized successfully");
            resolve();
          }
        });
      });
    });
  });
};

// Initialize database on module load
initializeDatabase().catch((err) => {
  logger.error("Failed to initialize database:", err);
});

// Export the database object and initialization function
module.exports = {
  get db() {
    return db;
  },
  initializeDatabase,
};
