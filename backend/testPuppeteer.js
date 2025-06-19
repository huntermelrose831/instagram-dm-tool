// Test script to verify Puppeteer is working correctly on Windows
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

async function testPuppeteerConfig() {
  console.log("Testing Puppeteer configurations...");

  const configs = [
    {
      name: "Primary Config",
      config: {
        headless: true,
        defaultViewport: null,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--start-maximized",
        ],
        timeout: 60000,
        protocolTimeout: 60000,
        ignoreDefaultArgs: ["--disable-extensions"],
      },
    },
    {
      name: "Fallback Config",
      config: {
        headless: true,
        defaultViewport: null,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        timeout: 60000,
        protocolTimeout: 60000,
      },
    },
    {
      name: "Basic Config",
      config: {
        headless: true,
        timeout: 60000,
      },
    },
  ];

  for (const { name, config } of configs) {
    try {
      console.log(`\nTesting ${name}...`);
      const browser = await puppeteer.launch(config);
      console.log(`✅ ${name} - Browser launched successfully`);

      const page = await browser.newPage();
      console.log(`✅ ${name} - New page created successfully`);

      await page.goto("https://www.google.com", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      console.log(`✅ ${name} - Navigation to Google successful`);

      const title = await page.title();
      console.log(`✅ ${name} - Page title: ${title}`);

      await browser.close();
      console.log(`✅ ${name} - Browser closed successfully`);

      console.log(`🎉 ${name} works perfectly!`);
      return name;
    } catch (error) {
      console.log(`❌ ${name} failed: ${error.message}`);
    }
  }

  throw new Error("All Puppeteer configurations failed!");
}

// Run the test
testPuppeteerConfig()
  .then((workingConfig) => {
    console.log(`\n🎉 Success! The "${workingConfig}" configuration works.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 All configurations failed:", error.message);
    console.log("\nTroubleshooting tips:");
    console.log("1. Make sure you have Chrome installed");
    console.log("2. Try running: npm install puppeteer --force");
    console.log("3. Check if Windows Defender or antivirus is blocking Chrome");
    console.log("4. Try running as administrator");
    process.exit(1);
  });
