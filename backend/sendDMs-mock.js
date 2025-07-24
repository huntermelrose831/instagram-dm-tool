// Mock DM sender for when Puppeteer fails
// This provides a fallback when Instagram automation isn't available

async function sendDMsMock({
  igUsername,
  usernames,
  message,
  campaignId = null,
  messageVariations = null,
}) {
  console.log("🎭 MOCK DM SENDER ACTIVATED");
  console.log(`Mock sending DMs from account: ${igUsername}`);
  
  const targetsArray = Array.isArray(usernames)
    ? usernames
    : usernames
        .split(/[\n,;]+/)
        .map((t) => t.trim())
        .filter(Boolean);

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock success for demonstration (in real scenario, this would log the attempt)
  const mockResults = {
    successCount: targetsArray.length,
    responseCount: 0, // No actual responses in mock
    variationStats: messageVariations
      ? messageVariations.map(() => ({ sent: 1, responses: 0 }))
      : [],
    rateLimitHits: 0,
    errors: [],
    totalTargets: targetsArray.length,
    isMock: true, // Flag to indicate this was a mock run
  };

  console.log(`🎭 Mock DM session complete: ${targetsArray.length} targets processed`);
  console.log("📝 Note: This was a simulation. No actual DMs were sent.");
  console.log("🔧 Fix Puppeteer configuration to enable real DM sending.");
  
  return mockResults;
}

module.exports = { sendDMsMock };
