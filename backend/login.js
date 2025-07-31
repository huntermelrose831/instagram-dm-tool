const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const AccountsService = require("./database/accounts");

puppeteer.use(StealthPlugin());

async function loginAndSaveCookies(username, password) {
  console.log(`Starting login process for ${username}...`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      "--start-maximized",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding"
    ],
  });

  try {
    const page = await browser.newPage();

    // Navigate to Instagram login
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
    });

    // Type credentials
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });

    // Click login and wait for navigation
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2" }),
    ]);

    // Verify login success
    try {
      await page.waitForSelector('svg[aria-label="Direct"]', {
        timeout: 10000,
      });
    } catch (e) {
      throw new Error("Login failed - could not verify success");
    }

    // Get cookies and save them
    const cookies = await page.cookies();
    const success = AccountsService.updateAccountCookies(username, cookies);

    if (success) {
      console.log("Login successful! Cookies saved to database.");
    } else {
      console.log("Login successful but failed to save cookies to database.");
    }

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Example usage:
// loginAndSaveCookies('your_username', 'your_password')
//   .then(console.log)
//   .catch(console.error);

module.exports = { loginAndSaveCookies };
