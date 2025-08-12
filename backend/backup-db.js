#!/usr/bin/env node

/**
 * Database Maintenance Script
 *
 * This script performs regular maintenance on the SQLite database:
 * - Creates a backup of the database
 * - Runs VACUUM to optimize the database
 * - Performs cleanup of old data
 *
 * Usage:
 * node backup-db.js
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const db = require("./database/db");
const logger = require("./utils/logger");

// Configuration
const BACKUP_DIR = path.join(__dirname, "backups");
const DB_PATH = path.join(__dirname, "database", "dmautomation.db");
const BACKUP_RETENTION_DAYS = 7;

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Create timestamp for backup filename
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFilename = `dmautomation-${timestamp}.db`;
const backupPath = path.join(BACKUP_DIR, backupFilename);

async function createBackup() {
  logger.info("Starting database backup...");

  try {
    // Use sqlite3 CLI for backup (more reliable than Node.js methods for larger DBs)
    return new Promise((resolve, reject) => {
      const process = spawn("sqlite3", [DB_PATH, `.backup '${backupPath}'`]);

      let stderr = "";

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          logger.info(`Database backup created: ${backupFilename}`);
          resolve(backupPath);
        } else {
          reject(new Error(`Backup failed with code ${code}: ${stderr}`));
        }
      });
    });
  } catch (err) {
    logger.error("Error creating SQLite backup:", err);

    // Fallback to direct file copy if sqlite3 CLI method fails
    try {
      fs.copyFileSync(DB_PATH, backupPath);
      logger.info(`Fallback backup created: ${backupFilename}`);
      return backupPath;
    } catch (copyErr) {
      logger.error("Fallback backup also failed:", copyErr);
      throw copyErr;
    }
  }
}

function optimizeDatabase() {
  logger.info("Optimizing database...");
  try {
    // Run VACUUM to optimize the database
    db.exec("VACUUM;");

    // Run ANALYZE to update statistics
    db.exec("ANALYZE;");

    logger.info("Database optimization completed");
  } catch (err) {
    logger.error("Error optimizing database:", err);
    throw err;
  }
}

function cleanupOldData() {
  logger.info("Cleaning up old data...");

  try {
    // Delete old logs (over 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const timestamp = thirtyDaysAgo.toISOString();

    // Delete old message history
    const messageDeleted = db
      .prepare(
        `
      DELETE FROM message_history 
      WHERE sent_at < datetime(?, 'unixepoch')
    `
      )
      .run(Math.floor(thirtyDaysAgo.getTime() / 1000));

    logger.info(
      `Deleted ${messageDeleted.changes} old message history records`
    );

    // Clean up completed/cancelled scheduled jobs
    const jobsDeleted = db
      .prepare(
        `
      DELETE FROM scheduled_jobs
      WHERE status IN ('completed', 'cancelled')
      AND updated_at < datetime(?, 'unixepoch')
    `
      )
      .run(Math.floor(thirtyDaysAgo.getTime() / 1000));

    logger.info(`Deleted ${jobsDeleted.changes} old scheduled jobs`);

    // More cleanup tasks can be added here

    return {
      messagesDeleted: messageDeleted.changes,
      jobsDeleted: jobsDeleted.changes,
    };
  } catch (err) {
    logger.error("Error cleaning up old data:", err);
    throw err;
  }
}

function deleteOldBackups() {
  logger.info("Cleaning up old backups...");

  try {
    const files = fs.readdirSync(BACKUP_DIR);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);

    let deletedCount = 0;

    for (const file of files) {
      if (!file.endsWith(".db")) continue;

      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    logger.info(`Deleted ${deletedCount} old backup files`);
    return deletedCount;
  } catch (err) {
    logger.error("Error cleaning up old backups:", err);
    throw err;
  }
}

async function main() {
  logger.info("=== Database maintenance started ===");

  try {
    // Step 1: Create backup
    await createBackup();

    // Step 2: Clean up old data
    cleanupOldData();

    // Step 3: Optimize database
    optimizeDatabase();

    // Step 4: Delete old backups
    deleteOldBackups();

    logger.info("=== Database maintenance completed successfully ===");
  } catch (err) {
    logger.error("Database maintenance failed:", err);
    process.exit(1);
  }
}

// Run the maintenance
main();
