const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

async function diagnosePuppeteer() {
  console.log("🔍 Diagnosing Puppeteer installation...");

  // Check if Chromium is available
  try {
    const executablePath = puppeteer.executablePath();
    console.log("✓ Puppeteer executable path:", executablePath);
  } catch (error) {
    console.error("✗ Cannot find Puppeteer executable:", error.message);
  }

  // Test minimal launch
  console.log("\n🚀 Testing minimal Puppeteer launch...");
  let browser;

  const configs = [
    {
      name: "Minimal headless",
      config: { headless: true, timeout: 10000 },
    },
    {
      name: "Minimal with no-sandbox",
      config: {
        headless: true,
        args: ["--no-sandbox"],
        timeout: 10000,
      },
    },
    {
      name: "Non-headless (visible browser)",
      config: {
        headless: false,
        args: ["--no-sandbox"],
        timeout: 10000,
      },
    },
  ];

  for (const { name, config } of configs) {
    try {
      console.log(`\nTesting: ${name}`);
      browser = await puppeteer.launch(config);
      console.log(`✓ ${name} - SUCCESS`);

      // Test page creation
      const page = await browser.newPage();
      console.log(`✓ ${name} - Page creation SUCCESS`);

      // Test navigation to a simple page
      await page.goto("data:text/html,<h1>Test</h1>", { timeout: 5000 });
      console.log(`✓ ${name} - Navigation SUCCESS`);

      await browser.close();
      console.log(`✓ ${name} - ALL TESTS PASSED`);
      return; // Exit on first success
    } catch (error) {
      console.error(`✗ ${name} - FAILED:`, error.message);
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
    }
  }

  console.error("\n❌ ALL PUPPETEER CONFIGURATIONS FAILED");
  console.log("\n💡 Possible solutions:");
  console.log("1. Install Chrome/Chromium manually:");
  console.log("   npm install puppeteer (downloads Chromium)");
  console.log("2. Use system Chrome:");
  console.log("   npm install puppeteer-core");
  console.log("3. Check Windows Defender/antivirus blocking browser launch");
  console.log("4. Run from administrator console");
  console.log("5. Check available disk space and permissions");
}

diagnosePuppeteer().catch(console.error);
