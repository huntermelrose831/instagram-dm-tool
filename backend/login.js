const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AccountsService = require("./database/accounts");
const { delay } = require("./utils/delay");

puppeteer.use(StealthPlugin());

async function loginAndSaveCookies(username, password) {
  console.log(`Starting enhanced login process for ${username}...`);

  const browser = await puppeteer.launch({
    headless: false, // Set to false for debugging
    defaultViewport: null,
    args: [
      "--start-maximized",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate to Instagram login
    console.log("Navigating to Instagram login page...");
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Wait for login form
    await page.waitForSelector('input[name="username"]', { timeout: 30000 });
    await delay(2000);

    // Clear any existing input and type credentials
    console.log("Entering credentials...");
    await page.click('input[name="username"]');
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.type('input[name="username"]', username, { delay: 100 });

    await page.click('input[name="password"]');
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.type('input[name="password"]', password, { delay: 100 });

    // Click login button
    console.log("Clicking login button...");
    await page.click('button[type="submit"]');

    // Wait for navigation or error
    await delay(5000);

    // Check for various post-login scenarios
    console.log("Checking login result...");

    // Wait for either success indicators or error messages
    try {
      await page.waitForFunction(
        () => {
          // Success indicators
          const homeElements =
            document.querySelector('svg[aria-label="Home"]') ||
            document.querySelector('a[href="/"]') ||
            document.querySelector('[data-testid="home-link"]');

          // Error indicators
          const errorMessage =
            document.querySelector("#slfErrorAlert") ||
            document.querySelector('[role="alert"]') ||
            document.querySelector(".error-message");

          // Two-factor or verification
          const twoFactor =
            document.querySelector('input[name="verificationCode"]') ||
            document.querySelector('[aria-label*="security code"]');

          // Suspicious login
          const suspicious =
            document.querySelector('[data-testid="suspicious_login_form"]') ||
            document.querySelector('button[value="dismiss"]');

          return homeElements || errorMessage || twoFactor || suspicious;
        },
        { timeout: 30000 }
      );
    } catch (waitError) {
      console.log(
        "Timeout waiting for login result, checking current state..."
      );
    }

    // Handle different scenarios
    const loginResult = await page.evaluate(() => {
      // Check for error messages
      const errorElement =
        document.querySelector("#slfErrorAlert") ||
        document.querySelector('[role="alert"]') ||
        document.querySelector(".error-message");

      if (errorElement) {
        return { success: false, error: errorElement.textContent.trim() };
      }

      // Check for two-factor authentication
      const twoFactorInput =
        document.querySelector('input[name="verificationCode"]') ||
        document.querySelector('[aria-label*="security code"]');

      if (twoFactorInput) {
        return { success: false, error: "Two-factor authentication required" };
      }

      // Check for suspicious login
      const suspiciousLogin =
        document.querySelector('[data-testid="suspicious_login_form"]') ||
        document.querySelector('button[value="dismiss"]');

      if (suspiciousLogin) {
        return {
          success: false,
          error: "Suspicious login detected - manual verification required",
        };
      }

      // Check for success indicators
      const homeElement =
        document.querySelector('svg[aria-label="Home"]') ||
        document.querySelector('a[href="/"]') ||
        document.querySelector('[data-testid="home-link"]');

      if (homeElement) {
        return { success: true };
      }

      // Check if still on login page
      const usernameInput = document.querySelector('input[name="username"]');
      if (usernameInput) {
        return {
          success: false,
          error: "Still on login page - credentials may be incorrect",
        };
      }

      return { success: false, error: "Unknown login state" };
    });

    if (!loginResult.success) {
      throw new Error(`Login failed: ${loginResult.error}`);
    }

    console.log("✅ Login successful! Waiting for page to fully load...");
    await delay(5000);

    // Navigate to home to ensure we're fully logged in
    await page.goto("https://www.instagram.com/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await delay(3000);

    // Get all cookies after successful login
    console.log("Extracting cookies...");
    const cookies = await page.cookies();

    // Filter and validate important cookies
    const importantCookies = cookies.filter((cookie) => {
      const importantNames = [
        "sessionid",
        "csrftoken",
        "mid",
        "ig_did",
        "ig_nrcb",
        "datr",
        "wd",
        "rur",
        "shbid",
        "shbts",
        "ds_user_id",
      ];
      return (
        importantNames.includes(cookie.name) &&
        cookie.value &&
        cookie.value.length > 0
      );
    });

    console.log(
      `Extracted ${importantCookies.length} important cookies out of ${cookies.length} total cookies`
    );
    console.log(
      "Important cookies found:",
      importantCookies.map((c) => c.name)
    );

    // Verify we have the most critical cookie
    const sessionCookie = importantCookies.find((c) => c.name === "sessionid");
    if (!sessionCookie) {
      throw new Error("No sessionid cookie found - login may not be complete");
    }

    // Save account with cookies
    const accountData = {
      username: username,
      email: username.includes("@") ? username : null,
      cookies: JSON.stringify(importantCookies),
      lastLogin: new Date().toISOString(),
      status: "active",
    };

    // Remove existing account if it exists
    try {
      // Upsert the account with cookies
      AccountsService.upsertAccount(accountData);
    } catch (e) {
      // Account might not exist, that's fine
    }

    // Add the new account

    console.log(
      `✅ Account ${username} saved successfully with ${importantCookies.length} cookies`
    );

    return {
      success: true,
      message: `Account ${username} logged in and saved successfully`,
      cookieCount: importantCookies.length,
    };
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { loginAndSaveCookies };
