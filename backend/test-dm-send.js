// Test script for DM functionality
// Run this with: node test-dm-send.js

const { sendDMs } = require('./sendDMs');

async function testDMSending() {
  console.log("🧪 Starting DM sending test...");
  
  try {
    // Test configuration - MODIFY THESE VALUES
    const testConfig = {
      igUsername: "your_instagram_username", // Replace with your Instagram username
      usernames: ["test_target_user"], // Replace with test target username(s)
      message: "Hello! This is a test message from the Instagram DM tool.",
      campaignId: null, // Optional campaign ID
      messageVariations: null // Optional message variations
    };
    
    console.log("Test configuration:", testConfig);
    console.log("\n📋 Instructions:");
    console.log("1. Make sure you have added your Instagram account using /api/add-account");
    console.log("2. Replace 'your_instagram_username' with your actual Instagram username");
    console.log("3. Replace 'test_target_user' with a test target username");
    console.log("4. The browser window will open and you can watch the automation");
    console.log("\n⚠️  IMPORTANT: Only send test messages to accounts you own or have permission to message!");
    
    // Uncomment the line below to actually run the test (after configuring)
    // const result = await sendDMs(testConfig);
    
    console.log("\n🚀 To run the actual test:");
    console.log("1. Update the testConfig object above with your details");
    console.log("2. Uncomment the sendDMs call");
    console.log("3. Run: node test-dm-send.js");
    
    // console.log("DM Test Results:", result);
  } catch (error) {
    console.error("❌ DM Test Error:", error.message);
    console.error("Full error:", error);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testDMSending();
}

module.exports = { testDMSending };
