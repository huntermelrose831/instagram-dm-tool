const { addScheduledJob } = require("./database/messaging");
const { processSingleMessage } = require("./scheduler");

async function testDMFlow() {
  console.log("🧪 Testing DM scheduling flow...");

  // Test 1: Schedule a DM for immediate execution
  const scheduleTime = new Date();
  scheduleTime.setMinutes(scheduleTime.getMinutes() + 1); // 1 minute from now

  const year = scheduleTime.getFullYear();
  const month = scheduleTime.getMonth() + 1;
  const day = scheduleTime.getDate();
  const hours = scheduleTime.getHours();
  const minutes = scheduleTime.getMinutes();
  const pad = (num) => String(num).padStart(2, "0");
  const scheduleTimeStr = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:00`;

  console.log(`Scheduling DM for: ${scheduleTimeStr}`);

  try {
    const jobId = addScheduledJob({
      fromUsername: "h7328715",
      targetUsernames: ["matthewstelling11"],
      messageVariations: ["Test message from automated system please ignore"],
      scheduleTime: scheduleTimeStr,
      isRecurring: false,
    });

    console.log(`✓ Job scheduled with ID: ${jobId}`);

    // Test 2: Try sending a single DM directly
    console.log("\n🚀 Testing direct DM send...");
    const success = await processSingleMessage(
      "h7328715@gmail.com",
      "matthewstelling11",
      "Test direct message"
    );

    if (success) {
      console.log("✓ Direct DM send: SUCCESS");
    } else {
      console.log("✗ Direct DM send: FAILED");
    }
  } catch (error) {
    console.error("✗ Test failed:", error.message);
  }
}

testDMFlow().catch(console.error);
