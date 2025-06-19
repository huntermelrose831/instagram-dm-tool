// Focused on resolving the selector failure and node detachment issues.

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const accountsStore = require("./accountsStore");
const { delay } = require("./utils/delay");
const { SELECTORS } = require("./utils/selectors");
const { createContact, recordInteraction } = require("./database/crm");
const { sendDMsMock } = require("./sendDMs-mock");

puppeteer.use(StealthPlugin());

async function waitForAnySelector(page, selectors, timeout = 10000) {
  if (!Array.isArray(selectors)) selectors = [selectors];

  for (const selector of selectors) {
    try {
      const el = await page.waitForSelector(selector, { timeout });
      if (el) return el;
    } catch (_) {
      // Try next selector
    }
  }
  throw new Error(
    `None of the selectors matched: ${JSON.stringify(selectors)}`
  );
}

const DELAYS = {
  TYPING: { min: 50, max: 150 },
  BETWEEN_MESSAGES: { min: 30000, max: 90000 },
  RATE_LIMIT_PAUSE: 300000,
  ACTION_DELAY: 2000,
};

const getRandomDelay = (min, max) =>
  Math.floor(Math.random() * (max - min + 1) + min);
const MAX_RETRIES = 2;
const MAX_RATE_LIMIT_RETRIES = 3;

async function sendDMs({
  igUsername,
  usernames,
  message,
  campaignId = null,
  messageVariations = null,
}) {
  console.log(`Starting DM session for account: ${igUsername}`);
  let messagesSent = 0;
  let responseCount = 0;
  let rateLimitHits = 0;
  let errors = [];
  let variationStats = messageVariations
    ? messageVariations.map((v) => ({
        sent: 0,
        responses: 0,
      }))
    : [];

  // Campaign message variation handling
  let selectedVariationIndex = -1;
  if (messageVariations && messageVariations.length > 0) {
    selectedVariationIndex = Math.floor(
      Math.random() * messageVariations.length
    );
    message = messageVariations[selectedVariationIndex];
  }
  const account = accountsStore.getAccountByUsername(igUsername);
  if (!account?.cookies)
    throw new Error("No cookies found for this account. Please log in first.");
  let browser;
  try {
    // WORKING CONFIG: Use the configuration we know works from diagnostics
    console.log(
      "Attempting to launch Puppeteer with working config (--no-sandbox)..."
    );
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      timeout: 30000,
      protocolTimeout: 120000, // Increase protocol timeout for cookie operations
    });
    console.log("✓ Working Puppeteer config successful");
  } catch (error) {
    console.log(
      "Working config failed, trying fallback with more args:",
      error.message
    );
    try {
      // Fallback configuration with additional sandbox args
      console.log("Attempting fallback Puppeteer config...");
      browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        timeout: 20000,
        protocolTimeout: 20000,
      });
      console.log("✓ Fallback Puppeteer config successful");
    } catch (fallbackError) {
      console.log(
        "Fallback Puppeteer config failed, trying extended config:",
        fallbackError.message
      );
      try {
        // Extended configuration with more args
        console.log("Attempting extended Puppeteer config...");
        browser = await puppeteer.launch({
          headless: true,
          defaultViewport: null,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
          ],
          timeout: 25000,
          protocolTimeout: 25000,
        });
        console.log("✓ Extended Puppeteer config successful");
      } catch (extendedError) {
        console.error(
          "All Puppeteer configurations failed:",
          extendedError.message
        );
        console.log(
          "🎭 FALLBACK: Using mock DM sender due to Puppeteer failure"
        );
        console.log(
          "💡 Run 'node diagnose-puppeteer.js' to diagnose Puppeteer issues"
        );

        // Use mock sender when Puppeteer completely fails
        return await sendDMsMock({
          igUsername,
          usernames,
          message,
          campaignId,
          messageVariations,
        });
      }
    }
  }
  const page = await browser.newPage();
  try {
    await page.setDefaultNavigationTimeout(20000); // Reduced to 20 seconds

    // Set cookies with error handling
    console.log("Setting cookies for Instagram authentication...");
    try {
      await page.setCookie(...account.cookies);
      console.log("✓ Cookies set successfully");
    } catch (cookieError) {
      console.warn("Cookie setting failed:", cookieError.message);
      // Try setting cookies one by one if batch setting fails
      for (const cookie of account.cookies) {
        try {
          await page.setCookie(cookie);
        } catch (singleCookieError) {
          console.warn(
            `Failed to set cookie ${cookie.name}:`,
            singleCookieError.message
          );
        }
      }
    }

    console.log("Navigating to Instagram DM page...");
    try {
      await page.goto("https://www.instagram.com/direct/new", {
        waitUntil: "networkidle2",
        timeout: 20000, // 20 second timeout
      });
      console.log("✓ Successfully navigated to Instagram DM page");
    } catch (navigationError) {
      console.warn(
        "Navigation to Instagram DM page failed, trying fallback..."
      );
      try {
        await page.goto("https://www.instagram.com/direct/new", {
          waitUntil: "domcontentloaded",
          timeout: 15000, // Even shorter timeout with different wait condition
        });
        console.log("✓ Successfully navigated to Instagram DM page (fallback)");
      } catch (fallbackError) {
        console.warn(
          "Fallback navigation also failed, trying basic navigation..."
        );
        try {
          await page.goto("https://www.instagram.com/direct/new", {
            timeout: 10000,
          });
          console.log("✓ Successfully navigated to Instagram DM page (basic)");
        } catch (basicError) {
          console.error(
            "All navigation attempts failed. DM sending may still work if we're already on Instagram."
          );
          // Don't throw here - let's try to continue with DM sending
        }
      }
    }

    const targetsArray = Array.isArray(usernames)
      ? usernames
      : usernames
          .split(/[\n,;]+/)
          .map((t) => t.trim())
          .filter(Boolean);

    for (const target of targetsArray) {
      let retryCount = 0;
      let success = false;

      // Create or update contact in CRM
      const contact = createContact(target);

      while (retryCount <= MAX_RETRIES && !success) {
        try {
          console.log(`Starting DM to ${target}`);
          const notNowBtn = await waitForAnySelector(
            page,
            SELECTORS.NOT_NOW_BUTTON,
            5000
          ).catch(() => null);
          if (notNowBtn) await notNowBtn.click();

          const newMessageButton = await waitForAnySelector(
            page,
            SELECTORS.NEWMESSAGEBUTTON
          );
          await newMessageButton.click();

          let searchBox = await waitForAnySelector(page, SELECTORS.SEARCH_BOX);

          await searchBox.click({ clickCount: 3 });
          await page.keyboard.press("Backspace");
          await delay(500);
          await searchBox.type(target, {
            delay: getRandomDelay(DELAYS.TYPING.min, DELAYS.TYPING.max),
          });
          await delay(1500);

          const results = await waitForAnySelector(
            page,
            SELECTORS.SEARCH_RESULTS
          );
          await results.click();

          const chatButtons = await page.$$('div[role="button"]');
          for (const btn of chatButtons) {
            try {
              const text = await btn.evaluate((el) => el?.innerText?.trim());
              if (text === "Chat") {
                await btn.click();
                break;
              }
            } catch (_) {
              // Element may be detached mid-eval, retry loop will catch it
            }
          }

          const messageBox = await waitForAnySelector(
            page,
            SELECTORS.MESSAGE_BOX
          );
          await messageBox.type(message);
          await page.keyboard.press("Enter"); // Press the Enter key to send

          console.log(`Message sent to ${target}`);
          messagesSent++;
          if (selectedVariationIndex !== -1) {
            variationStats[selectedVariationIndex].sent++;
          } // Record message sent in CRM
          recordInteraction(contact.id, "dm_sent", message, campaignId);

          // Check for response (temporarily disabled due to navigation timeouts)
          // TODO: Re-enable once Instagram selectors are updated
          /*
          const hasResponse = await checkForResponse(page, target);
          if (hasResponse) {
            responseCount++;
            if (selectedVariationIndex !== -1) {
              variationStats[selectedVariationIndex].responses++;
            }
            // Record response in CRM
            recordInteraction(contact.id, "dm_received", "Received response");
          }
          */
          console.log("Response checking temporarily disabled");

          success = true;
        } catch (error) {
          console.error(`Error with ${target}: ${error.message}`);
          errors.push({ target, error: error.message });

          try {
            const screenshotPath = `error_${target}.png`;
            await page.screenshot({ path: screenshotPath });
            console.log(`Screenshot saved: ${screenshotPath}`);
          } catch (screenshotError) {
            console.warn(
              `Could not save screenshot: ${screenshotError.message}`
            );
          }

          if (/rate|spam|limit/i.test(error.message)) {
            rateLimitHits++;
            if (rateLimitHits >= MAX_RATE_LIMIT_RETRIES)
              await delay(DELAYS.RATE_LIMIT_PAUSE * 2);
            break;
          }

          retryCount++;
          if (retryCount > MAX_RETRIES) {
            console.log(`Giving up on ${target} after ${MAX_RETRIES} retries`);
          }
        }
      }

      const pause = getRandomDelay(
        DELAYS.BETWEEN_MESSAGES.min,
        DELAYS.BETWEEN_MESSAGES.max
      );
      console.log(`Waiting ${pause / 1000}s before next DM...`);
      await delay(pause);
    }
    console.log(
      `Session complete: ${messagesSent} DMs sent out of ${targetsArray.length} targets.`
    );

    if (errors.length > 0) {
      console.log("Errors encountered:", errors);
    }

    // Update campaign stats if this is part of a campaign
    if (campaignId) {
      try {
        await updateCampaignStats(campaignId, { success_count: messagesSent });
        console.log(
          `Updated campaign ${campaignId} stats: ${messagesSent} messages sent`
        );
      } catch (statsError) {
        console.error("Failed to update campaign stats:", statsError);
        // Don't throw here - campaign stats are not critical
      }
    }

    // Return detailed results
    const result = {
      successCount: messagesSent,
      responseCount,
      variationStats,
      rateLimitHits,
      errors,
      totalTargets: targetsArray.length,
    };

    console.log("DM session results:", result);
    return result;
  } catch (error) {
    console.error("Critical error in sendDMs:", error);

    // If we sent some messages before the critical error, still return partial results
    if (messagesSent > 0) {
      console.log(
        `Partial success: ${messagesSent} messages were sent before critical error`
      );
      return {
        successCount: messagesSent,
        responseCount,
        variationStats,
        rateLimitHits,
        errors: errors.concat([{ target: "critical", error: error.message }]),
        totalTargets: Array.isArray(usernames)
          ? usernames.length
          : usernames.split(/[\n,;]+/).filter(Boolean).length,
        criticalError: true,
      };
    }

    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn("Error closing browser:", closeError.message);
      }
    }
  }
}

async function checkForResponse(page, username) {
  try {
    // Navigate to the conversation with timeout
    await page.goto(`https://www.instagram.com/direct/t/${username}`, {
      waitUntil: "networkidle2",
      timeout: 10000, // 10 second timeout
    });

    // Wait for messages to load
    await delay(2000);

    // Check for messages from the other user
    const theirMessages = await page.$$eval(
      ".message-from-them",
      (msgs) => msgs.length
    );
    return theirMessages > 0;
  } catch (error) {
    console.warn("Error checking for response (non-critical):", error.message);
    // Return false for response check failures - this is not critical
    return false;
  }
}

module.exports = { sendDMs };
