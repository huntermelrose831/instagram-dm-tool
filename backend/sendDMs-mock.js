// Mock DM sender for testing when Puppeteer fails
const { delay } = require("./utils/delay");

async function sendDMsMock({
  igUsername,
  usernames,
  message,
  campaignId = null,
  messageVariations = null,
}) {
  console.log(`🎭 MOCK DM SESSION for account: ${igUsername}`);
  console.log(`📝 Message: "${message}"`);

  const targetsArray = Array.isArray(usernames)
    ? usernames
    : usernames
        .split(/[\n,;]+/)
        .map((t) => t.trim())
        .filter(Boolean);

  console.log(`🎯 Targets (${targetsArray.length}):`, targetsArray);

  let messagesSent = 0;
  let errors = [];

  for (const target of targetsArray) {
    // Simulate processing time
    await delay(1000 + Math.random() * 2000);

    // Simulate 80% success rate
    const success = Math.random() > 0.2;

    if (success) {
      console.log(`✅ MOCK: Successfully "sent" DM to ${target}`);
      messagesSent++;
    } else {
      const errorMsg = "Mock error: Simulated failure";
      console.log(`❌ MOCK: Failed to "send" DM to ${target} - ${errorMsg}`);
      errors.push({ target, error: errorMsg });
    }
  }

  const result = {
    successCount: messagesSent,
    responseCount: 0,
    variationStats: [],
    rateLimitHits: 0,
    errors,
    totalTargets: targetsArray.length,
    isMock: true,
  };

  console.log(`🎭 MOCK session complete:`, result);
  return result;
}

module.exports = { sendDMsMock };
