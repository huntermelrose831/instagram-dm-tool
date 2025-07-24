// API test script for testing DM functionality via server endpoints
// Make sure the server is running (npm start) before using this

const testDMAPI = async () => {
  console.log("🌐 Testing DM API endpoints...");
  
  const serverUrl = "http://localhost:5000";
  
  // Test data - MODIFY THESE VALUES
  const testData = {
    username: "your_instagram_username", // Your Instagram username
    usernames: ["test_target_user"], // Target usernames (array or newline-separated string)
    message: "Hello! This is a test message from the Instagram DM API.",
    scheduled: false, // Set to true if you want to schedule instead of send immediately
    scheduleTime: null, // Required if scheduled is true
    messageVariations: ["Hello!", "Hi there!", "Hey!"] // Optional message variations
  };
  
  console.log("📋 API Test Configuration:");
  console.log(JSON.stringify(testData, null, 2));
  
  console.log("\n🔧 Instructions:");
  console.log("1. Make sure your server is running: npm start");
  console.log("2. Update the testData object above with your Instagram username");
  console.log("3. Replace 'test_target_user' with actual test targets");
  console.log("4. Uncomment the fetch request below to run the test");
  console.log("5. Check the server console to see the browser automation");
  
  console.log("\n📡 To test the API:");
  console.log(`curl -X POST ${serverUrl}/api/send-dms \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '${JSON.stringify(testData)}'`);
  
  /*
  // Uncomment this section to actually make the API call
  try {
    const response = await fetch(`${serverUrl}/api/send-dms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    console.log("\n✅ API Response:", result);
  } catch (error) {
    console.error("\n❌ API Error:", error.message);
  }
  */
};

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log("❌ This script requires Node.js 18+ or you can use curl instead");
  console.log("Alternative: Use the curl command shown above");
} else {
  testDMAPI();
}
