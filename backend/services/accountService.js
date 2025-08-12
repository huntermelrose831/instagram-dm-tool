const puppeteer = require("puppeteer");
const logger = require("../utils/logger");
const accountsStore = require("../accountsStore");
const { AccountsService } = require("../database");

/**
 * Add a new Instagram account by logging in and saving cookies
 * @param {string} username - Instagram username
 * @param {string} password - Instagram password
 * @returns {Promise<{success: boolean, message: string}>} Result object
 */
async function addAccount(username, password) {
  try {
    logger.info(`Attempting to add Instagram account: ${username}`);

    // Launch Puppeteer with security settings
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Set user agent to look more like a real browser
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Block unnecessary resources to improve performance
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const resourceType = request.resourceType();
      if (["image", "media", "font"].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    logger.info(`Navigating to Instagram login page for ${username}`);
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });

    logger.info(`Submitting login form for ${username}`);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
    ]);

    // Check for login success
    let loginSuccess = false;
    try {
      await page.waitForSelector('svg[aria-label="New post"]', {
        timeout: 15000,
      });
      loginSuccess = true;
      logger.info(`Login successful for ${username}`);
    } catch (e) {
      logger.warn(`Login indicator not found for ${username}: ${e.message}`);

      // Check for alternate success indicators
      try {
        const url = page.url();
        if (url.includes("instagram.com/") && !url.includes("accounts/login")) {
          loginSuccess = true;
          logger.info(`Login appears successful based on URL for ${username}`);
        }
      } catch (urlError) {
        logger.error(`Error checking URL after login: ${urlError.message}`);
      }
    }

    if (!loginSuccess) {
      logger.warn(`Login failed for ${username}`);
      await browser.close();
      return {
        success: false,
        message:
          "Instagram login failed. Please verify your credentials or try again later.",
      };
    }

    // Save cookies
    const cookies = await page.cookies();
    accountsStore.upsertAccount({ username, cookies });

    // Save account to database
    try {
      AccountsService.upsertAccount({
        username,
        passwordHash: password, // In production, should use proper password hashing
        isActive: true,
      });
    } catch (dbError) {
      logger.error(
        `Database error when saving account ${username}: ${dbError.message}`
      );
      // Continue anyway since we saved the cookies
    }

    await browser.close();
    logger.info(`Account ${username} successfully added`);

    return {
      success: true,
      message: "Instagram account added successfully",
    };
  } catch (err) {
    logger.error(`Error adding account ${username}: ${err.message}`);
    return {
      success: false,
      message: err.message || "Failed to add Instagram account",
    };
  }
}

module.exports = {
  addAccount,
};
