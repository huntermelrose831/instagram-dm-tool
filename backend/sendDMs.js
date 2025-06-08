// Focused on resolving the selector failure and node detachment issues.

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const accountsStore = require("./accountsStore");
const { delay } = require("./utils/delay");
const { SELECTORS } = require("./utils/selectors");
const { createContact, recordInteraction } = require("./database/crm");

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

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ["--start-maximized"],
  });
  const page = await browser.newPage();

  try {
    await page.setDefaultNavigationTimeout(60000);
    await page.setCookie(...account.cookies);
    await page.goto("https://www.instagram.com/direct/new", {
      waitUntil: "networkidle2",
    });

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
          }

          // Record message sent in CRM
          recordInteraction(contact.id, "dm_sent", message, campaignId);

          // Check for response
          const hasResponse = await checkForResponse(page, target);
          if (hasResponse) {
            responseCount++;
            if (selectedVariationIndex !== -1) {
              variationStats[selectedVariationIndex].responses++;
            }
            // Record response in CRM
            recordInteraction(contact.id, "dm_received", "Received response");
          }

          success = true;
        } catch (error) {
          console.error(`Error with ${target}: ${error.message}`);
          const screenshotPath = `error_${target}.png`;
          await page.screenshot({ path: screenshotPath });

          if (/rate|spam|limit/i.test(error.message)) {
            rateLimitHits++;
            if (rateLimitHits >= MAX_RATE_LIMIT_RETRIES)
              await delay(DELAYS.RATE_LIMIT_PAUSE * 2);
            break;
          }

          retryCount++;
          if (retryCount > MAX_RETRIES) console.log(`Giving up on ${target}`);
        }
      }

      const pause = getRandomDelay(
        DELAYS.BETWEEN_MESSAGES.min,
        DELAYS.BETWEEN_MESSAGES.max
      );
      console.log(`Waiting ${pause / 1000}s before next DM...`);
      await delay(pause);
    }
    console.log(`Session complete: ${messagesSent} DMs sent.`);

    // Update campaign stats if this is part of a campaign
    if (campaignId) {
      try {
        await updateCampaignStats(campaignId, { success_count: messagesSent });
        console.log(
          `Updated campaign ${campaignId} stats: ${messagesSent} messages sent`
        );
      } catch (statsError) {
        console.error("Failed to update campaign stats:", statsError);
      }
    }

    return {
      successCount: messagesSent,
      responseCount,
      variationStats,
      rateLimitHits,
    };
  } catch (error) {
    console.error("Error in sendDMs:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function checkForResponse(page, username) {
  try {
    // Navigate to the conversation
    await page.goto(`https://www.instagram.com/direct/t/${username}`, {
      waitUntil: "networkidle2",
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
    console.error("Error checking for response:", error);
    return false;
  }
}

module.exports = { sendDMs };
