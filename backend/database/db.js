const Database = require("better-sqlite3");
const path = require("path");

// Initialize database connection - database already exists with all tables
const db = new Database(path.join(__dirname, "dmautomation.db"));

// Enable foreign keys and optimize settings
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

console.log("✅ Database connection established successfully");

module.exports = db;
