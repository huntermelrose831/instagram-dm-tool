const Database = require("better-sqlite3");
const path = require("path");

// Test database functionality
function testDatabase() {
  const dbPath = path.join(__dirname, "dmautomation.db");
  const db = new Database(dbPath);

  console.log("Testing dm_rate_limits table:");
  try {
    const stmt = db.prepare(`
            INSERT INTO dm_rate_limits (username, daily_dm_count, last_dm_time, last_reset_date, total_dm_sent)
            VALUES (?, 1, CURRENT_TIMESTAMP, DATE('now', 'localtime'), 1)
            ON CONFLICT(username) DO UPDATE SET
            daily_dm_count = daily_dm_count + 1,
            total_dm_sent = total_dm_sent + 1
        `);
    const testUser = "test_user_" + Date.now();
    stmt.run(testUser);
    console.log("✓ dm_rate_limits UPSERT works correctly");

    // Clean up
    db.prepare("DELETE FROM dm_rate_limits WHERE username = ?").run(testUser);
  } catch (error) {
    console.error("✗ dm_rate_limits error:", error.message);
  }

  console.log("\nChecking scheduled_jobs table structure:");
  try {
    const columns = db.prepare("PRAGMA table_info(scheduled_jobs)").all();
    console.log(
      "scheduled_jobs columns:",
      columns.map((c) => c.name).join(", ")
    );

    // Check if status column has proper constraints
    const createInfo = db
      .prepare(
        'SELECT sql FROM sqlite_master WHERE type="table" AND name="scheduled_jobs"'
      )
      .get();
    console.log("scheduled_jobs CREATE statement:");
    console.log(createInfo.sql);
  } catch (error) {
    console.error("Error checking scheduled_jobs:", error.message);
  }

  console.log("\nTesting scheduled job operations:");
  try {
    // Test job insertion
    const insertStmt = db.prepare(`
            INSERT INTO scheduled_jobs (from_username, target_usernames, message_variations, schedule_time, status)
            VALUES (?, ?, ?, ?, ?)
        `);

    const testJobId = insertStmt.run(
      "test@example.com",
      JSON.stringify(["user1", "user2"]),
      JSON.stringify(["Hello!", "Hi there!"]),
      "2025-06-18 20:00:00",
      "pending"
    ).lastInsertRowid;

    console.log("✓ Job insertion works, ID:", testJobId);

    // Test job status update
    const updateStmt = db.prepare(
      "UPDATE scheduled_jobs SET status = ? WHERE id = ?"
    );
    updateStmt.run("completed", testJobId);
    console.log("✓ Job status update works");

    // Clean up
    db.prepare("DELETE FROM scheduled_jobs WHERE id = ?").run(testJobId);
    console.log("✓ Job deletion works");
  } catch (error) {
    console.error("✗ Scheduled job operations error:", error.message);
  }

  db.close();
  console.log("\nDatabase tests completed.");
}

testDatabase();
