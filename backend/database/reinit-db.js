const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Reinitialize the database with clean schema
async function reinitializeDatabase() {
  const dbPath = path.join(__dirname, "..", "dmautomation.db"); // Fixed: use same path as main system

  // Backup existing database if it exists
  if (fs.existsSync(dbPath)) {
    const backupPath = path.join(
      __dirname,
      `dmautomation_backup_${Date.now()}.db`
    );
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Database backed up to: ${backupPath}`);
  }

  // Create new database with clean schema
  const db = new Database(dbPath);
  const schemaPath = path.join(__dirname, "schema_clean.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  // Execute schema
  db.exec(schema);

  console.log("Database reinitialized with clean schema");
  // Test dm_rate_limits table
  try {
    const stmt = db.prepare(`
            INSERT INTO dm_rate_limits (username, daily_dm_count, last_dm_time, last_reset_date, total_dm_sent)
            VALUES (?, 1, CURRENT_TIMESTAMP, DATE('now', 'localtime'), 1)
            ON CONFLICT(username) DO UPDATE SET
            daily_dm_count = CASE 
              WHEN DATE(last_reset_date) < DATE('now', 'localtime')
              THEN 1
              ELSE daily_dm_count + 1
            END,
            last_dm_time = CURRENT_TIMESTAMP,
            last_reset_date = CASE 
              WHEN DATE(last_reset_date) < DATE('now', 'localtime')
              THEN DATE('now', 'localtime')
              ELSE last_reset_date
            END,
            total_dm_sent = total_dm_sent + 1
        `);
    stmt.run("test_user");
    console.log("dm_rate_limits table test: PASSED");

    // Clean up test data
    db.prepare("DELETE FROM dm_rate_limits WHERE username = ?").run(
      "test_user"
    );
  } catch (error) {
    console.error("dm_rate_limits table test: FAILED", error);
  }

  db.close();
}

if (require.main === module) {
  reinitializeDatabase().catch(console.error);
}

module.exports = { reinitializeDatabase };
