#!/usr/bin/env node

/**
 * Database Schema Validation Script
 *
 * This script validates that the current database schema matches the expected schema.
 * It's useful for detecting schema drift or issues after migrations.
 */

const fs = require("fs");
const path = require("path");
const db = require("./database/db");
const logger = require("./utils/logger");

// Expected tables and their columns
const expectedSchema = {
  accounts: [
    "id",
    "username",
    "email",
    "password_hash",
    "proxy_id",
    "health_score",
    "risk_level",
    "is_active",
    "created_at",
    "updated_at",
  ],
  proxies: [
    "id",
    "host",
    "port",
    "username",
    "password",
    "type",
    "is_active",
    "last_used",
    "success_count",
    "failure_count",
    "created_at",
    "updated_at",
  ],
  rate_limits: [
    "id",
    "username",
    "daily_limit",
    "hourly_limit",
    "messages_sent_today",
    "messages_sent_hour",
    "follow_daily_limit",
    "follow_hourly_limit",
    "follows_today",
    "follows_hour",
    "last_message_time",
    "last_follow_time",
    "last_reset_day",
    "last_reset_hour",
    "is_active",
    "created_at",
    "updated_at",
  ],
  leads: [
    "id",
    "username",
    "profile_url",
    "source",
    "source_url",
    "is_target",
    "notes",
    "scraped_at",
    "engagement_count",
    "engagement_rate",
    "followers_count",
    "following_count",
    "location",
    "created_at",
    "updated_at",
  ],
  scheduled_jobs: [
    "id",
    "from_username",
    "target_usernames",
    "message_variations",
    "schedule_time",
    "is_recurring",
    "recurring_interval",
    "status",
    "last_run_time",
    "next_run_time",
    "created_at",
    "updated_at",
  ],
  message_history: [
    "id",
    "from_username",
    "to_username",
    "message_content",
    "sent_at",
    "scheduled_job_id",
    "status",
    "error_message",
  ],
  crm_contacts: [
    "id",
    "username",
    "full_name",
    "email",
    "phone",
    "status",
    "lifecycle_stage",
    "last_interaction",
    "created_at",
    "updated_at",
  ],
  crm_notes: ["id", "contact_id", "content", "created_at", "updated_at"],
  crm_tags: ["id", "name", "color", "created_at"],
  crm_contact_tags: ["contact_id", "tag_id", "created_at"],
  crm_interactions: [
    "id",
    "contact_id",
    "type",
    "content",
    "campaign_id",
    "created_at",
  ],
};

function getActualSchema() {
  // Get all tables
  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%' 
  `
    )
    .all()
    .map((row) => row.name);

  const schema = {};

  // For each table, get its columns
  tables.forEach((tableName) => {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
    schema[tableName] = tableInfo.map((col) => col.name);
  });

  return schema;
}

function validateSchema() {
  logger.info("Validating database schema...");

  const actualSchema = getActualSchema();
  const issues = [];

  // Check for missing tables
  Object.keys(expectedSchema).forEach((tableName) => {
    if (!actualSchema[tableName]) {
      issues.push(`Missing table: ${tableName}`);
    } else {
      // Check for missing columns
      expectedSchema[tableName].forEach((columnName) => {
        if (!actualSchema[tableName].includes(columnName)) {
          issues.push(`Missing column: ${tableName}.${columnName}`);
        }
      });
    }
  });

  // Check for unexpected tables
  Object.keys(actualSchema).forEach((tableName) => {
    if (!expectedSchema[tableName] && !tableName.startsWith("sqlite_")) {
      issues.push(`Unexpected table: ${tableName}`);
    }
  });

  // Report results
  if (issues.length > 0) {
    logger.error("Schema validation failed with the following issues:");
    issues.forEach((issue) => logger.error(`- ${issue}`));
    return false;
  } else {
    logger.info(
      "Schema validation passed. All expected tables and columns found."
    );
    return true;
  }
}

// If running as main script
if (require.main === module) {
  try {
    const isValid = validateSchema();
    process.exit(isValid ? 0 : 1);
  } catch (error) {
    logger.error("Schema validation error:", error);
    process.exit(1);
  }
}

module.exports = {
  validateSchema,
  getActualSchema,
  expectedSchema,
};
