const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

// Determine database path - allowing for custom path in production
const dbPath = process.env.DB_PATH || path.join(__dirname, "dmautomation.db");
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection with proper error handling
let db;
try {
  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === "development" ? console.log : undefined,
    fileMustExist: false, // Allow creating new DB if it doesn't exist
  });

  // Enable foreign keys and optimize settings
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  // Set busy timeout to prevent SQLITE_BUSY errors
  db.pragma("busy_timeout = 5000");

  logger.info("✅ Database connection established successfully");

  // Check if we need to initialize the database schema
  const tableCount = db
    .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'")
    .get().count;
  if (tableCount === 0) {
    logger.info("Initializing new database schema...");

    // Read and execute schema creation SQL
    const schemaPath = path.join(__dirname, "schema.sql");
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, "utf8");
      db.exec(schemaSql);
      logger.info("Database schema initialized successfully");
    } else {
      logger.warn("Schema file not found at:", schemaPath);
    }
  }
} catch (err) {
  logger.error(`Database connection error: ${err.message}`);
  throw new Error(`Failed to connect to database: ${err.message}`);
}

// Create a wrapper with improved error handling for database operations
const safeDb = {
  prepare: (sql) => {
    try {
      return db.prepare(sql);
    } catch (err) {
      logger.error(`SQL preparation error: ${err.message}, SQL: ${sql}`);
      throw err;
    }
  },
  exec: (sql) => {
    try {
      return db.exec(sql);
    } catch (err) {
      logger.error(`SQL execution error: ${err.message}, SQL: ${sql}`);
      throw err;
    }
  },
  transaction: (fn) => {
    try {
      return db.transaction(fn);
    } catch (err) {
      logger.error(`Transaction error: ${err.message}`);
      throw err;
    }
  },
  pragma: (pragmaStatement) => {
    try {
      return db.pragma(pragmaStatement);
    } catch (err) {
      logger.error(
        `Pragma error: ${err.message}, Statement: ${pragmaStatement}`
      );
      throw err;
    }
  },
  backup: (filename) => {
    try {
      return db.backup(filename);
    } catch (err) {
      logger.error(`Backup error: ${err.message}, File: ${filename}`);
      throw err;
    }
  },
  close: () => {
    try {
      return db.close();
    } catch (err) {
      logger.error(`Close error: ${err.message}`);
      throw err;
    }
  },
};

module.exports = safeDb;
