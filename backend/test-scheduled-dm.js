const { addScheduledJob } = require("./database/messaging");
const { checkPendingJobs } = require("./scheduler");

async function testScheduledDM() {
  console.log("🧪 Testing scheduled DM functionality...\n");

  // Schedule a DM for 30 seconds from now
  const scheduleTime = new Date(Date.now() + 30000);
  const scheduleTimeString =
    scheduleTime.toLocaleDateString("en-CA") +
    " " +
    scheduleTime.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  console.log(`Scheduling DM for: ${scheduleTimeString}`);

  const jobId = addScheduledJob({
    fromUsername: "h7328715",
    targetUsernames: ["testuser123"],
    messageVariations: ["Scheduled test message from automation system"],
    scheduleTime: scheduleTimeString,
    isRecurring: false,
  });

  console.log(`✓ Job scheduled with ID: ${jobId}`);
  console.log(`⏰ Waiting for scheduled time (30 seconds)...`);

  // Wait 35 seconds then check if the job was processed
  setTimeout(async () => {
    console.log("\n🔍 Checking if job was processed...");

    // Run one cycle of pending job check
    try {
      await checkPendingJobs();
      console.log("✓ Pending job check completed");
    } catch (error) {
      console.error("❌ Error during job check:", error.message);
    }
  }, 35000);

  console.log(
    "Test initiated. Job should be processed automatically by the scheduler."
  );
  console.log("Monitor the console for job execution logs...");
}

testScheduledDM().catch(console.error);
