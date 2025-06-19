const { updateDMRateLimits } = require("./database/messaging");
const db = require("./database/db");

async function testDatabaseOperations() {
  console.log("Testing database operations...");

  try {
    // Test dm_rate_limits table operations
    console.log("\n1. Testing updateDMRateLimits...");
    await updateDMRateLimits("test_user_1");
    console.log("✓ First insert successful");

    await updateDMRateLimits("test_user_1");
    console.log("✓ Update on conflict successful");

    // Check the result
    const result = db
      .prepare("SELECT * FROM dm_rate_limits WHERE username = ?")
      .get("test_user_1");
    console.log("Rate limit data:", result);

    // Clean up
    db.prepare("DELETE FROM dm_rate_limits WHERE username = ?").run(
      "test_user_1"
    );
    console.log("✓ Cleanup successful");
  } catch (error) {
    console.error("❌ Database test failed:", error);

    // Check if the table exists and has the right structure
    try {
      const tableInfo = db.prepare("PRAGMA table_info(dm_rate_limits)").all();
      console.log("dm_rate_limits table structure:", tableInfo);

      const indexes = db.prepare("PRAGMA index_list(dm_rate_limits)").all();
      console.log("dm_rate_limits indexes:", indexes);
    } catch (pragmaError) {
      console.error("Could not get table info:", pragmaError);
    }
  }

  // Test job status operations
  try {
    console.log("\n2. Testing job status operations...");

    // First create a test job
    const {
      addScheduledJob,
      updateJobStatus,
      deleteScheduledJob,
    } = require("./database/messaging");

    const jobId = addScheduledJob({
      fromUsername: "test@test.com",
      targetUsernames: ["target1", "target2"],
      messageVariations: ["Hello test"],
      scheduleTime: "2025-06-18 12:00:00",
      isRecurring: false,
    });

    console.log("✓ Created test job:", jobId);

    // Test status updates
    updateJobStatus(jobId, "running");
    console.log("✓ Updated job to running");

    updateJobStatus(jobId, "completed");
    console.log("✓ Updated job to completed");

    // Clean up
    deleteScheduledJob(jobId);
    console.log("✓ Deleted test job");
  } catch (error) {
    console.error("❌ Job operations test failed:", error);
  }

  console.log("\nDatabase tests completed.");
}

if (require.main === module) {
  testDatabaseOperations().catch(console.error);
}

module.exports = { testDatabaseOperations };
