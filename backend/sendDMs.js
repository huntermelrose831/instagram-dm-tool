// Focused on resolving the selector failure and node detachment issues.

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AccountsService = require("./database/accounts");
const { delay } = require("./utils/delay");
const { SELECTORS } = require("./utils/selectors");
const { createContact, recordInteraction } = require("./database/crm");
const { sendDMsMock } = require("./sendDMs-mock");
const config = require("./config");

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

// New helper: ensure we are on the compose (new DM) screen without relying on the New Message button
async function ensureComposeScreen(page) {
  try {
    if (!page.url().includes("/direct/new")) {
      console.log("🔄 Navigating directly to compose screen (/direct/new)...");
      await page.goto("https://www.instagram.com/direct/new", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await delay(1200 + Math.random() * 800);
    }
  } catch (e) {
    console.warn(
      "⚠️ Failed direct compose navigation, attempting inbox then compose:",
      e.message
    );
    try {
      await page.goto("https://www.instagram.com/direct/inbox/", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await delay(1000);
      await page.goto("https://www.instagram.com/direct/new", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await delay(1000);
    } catch (e2) {
      console.warn(
        "⚠️ Fallback compose navigation also failed; continuing and will retry later.",
        e2.message
      );
    }
  }
}

const DELAYS = {
  TYPING: config.dm.delays.typing,
  BETWEEN_MESSAGES: config.dm.delays.between,
  RATE_LIMIT_PAUSE: config.dm.delays.rateLimitPause,
  ACTION_DELAY: config.dm.delays.action,
  INITIAL_COOLDOWN: config.dm.delays.initialCooldown,
};

const getRandomDelay = (min, max) =>
  Math.floor(Math.random() * (max - min + 1) + min);
const MAX_RETRIES = config.dm.limits.maxRetries;
const MAX_RATE_LIMIT_RETRIES = config.dm.limits.maxRateLimitRetries;
const MAX_CONSECUTIVE_ERRORS = config.dm.limits.maxConsecutiveErrors; // Stop if we hit configured consecutive errors

async function sendDMs({
  igEmail,
  usernames,
  message,
  campaignId = null,
  messageVariations = null,
  onProgress = null,
}) {
  try {
    if (global.metrics)
      global.metrics.dmStarts = (global.metrics.dmStarts || 0) + 1;
  } catch (_) {}
  const report = (stage, msg, percent, extra = {}) => {
    console.log(msg);
    try {
      onProgress &&
        onProgress({
          stage,
          message: msg,
          percent,
          ...extra,
          time: new Date().toISOString(),
        });
    } catch (_) {}
  };
  report("start", `Initializing DM automation...`, 0);

  // Add initial cooldown to avoid immediate rate limiting
  console.log(`🕒 Initial cooldown: ${DELAYS.INITIAL_COOLDOWN / 1000}s`);
  await delay(DELAYS.INITIAL_COOLDOWN);

  let messagesSent = 0;
  let responseCount = 0;
  let rateLimitHits = 0;
  let consecutiveErrors = 0; // Track consecutive errors for exponential backoff
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
  // Lookup by email only
  const account = AccountsService.getAccountByEmail(igEmail);
  if (
    !account ||
    !Array.isArray(account.cookies) ||
    account.cookies.length === 0
  ) {
    // Fallback to mock if no cookies found
    console.warn("No cookies found for this account. Using mock DM sender.");
    return await sendDMsMock({
      igEmail,
      usernames,
      message,
      campaignId,
      messageVariations,
    });
  }
  let browser;
  try {
    // WORKING CONFIG: Use the configuration we know works from diagnostics
    console.log(
      "Attempting to launch Puppeteer with working config (--no-sandbox)..."
    );
    report("launch_browser", "Connecting to Instagram...", 10);
    browser = await puppeteer.launch({
      headless: false,
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
        headless: false,
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
          headless: false,
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
        // Use mock sender when Puppeteer completely fails
        return await sendDMsMock({
          igEmail,
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
    await page.setDefaultNavigationTimeout(30000);

    // Set user agent to avoid detection
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate to Instagram home page first, with retry logic
    console.log("Loading Instagram...");
    report("navigate_home", "Loading Instagram...", 20);
    let homeLoaded = false;
    for (let attempt = 1; attempt <= 2 && !homeLoaded; attempt++) {
      try {
        await page.goto("https://www.instagram.com/", {
          waitUntil: "domcontentloaded",
          timeout: 35000,
        });
        homeLoaded = true;
      } catch (err) {
        console.warn(
          `Attempt ${attempt} to load Instagram home failed: ${err.message}`
        );
        if (attempt === 2) throw err;
        await delay(2000);
      }
    }

    // Set cookies in the correct domain context
    console.log("Applying authentication cookies...");
    report("set_cookies", "Authenticating account...", 30);
    let cookiesSet = 0;
    const currentCookies = await page.cookies();
    console.log(`Found ${currentCookies.length} existing cookies`);

    for (const cookie of account.cookies) {
      try {
        // Ensure cookie is formatted correctly for Instagram domain
        const cleanCookie = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || ".instagram.com",
          path: cookie.path || "/",
          httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
          secure: cookie.secure !== undefined ? cookie.secure : true,
          sameSite: cookie.sameSite || "None",
        };

        // Add expiration only if valid and not expired
        if (cookie.expires && cookie.expires > Date.now() / 1000) {
          cleanCookie.expires = cookie.expires;
        }

        await page.setCookie(cleanCookie);
        cookiesSet++;
        console.log(`✓ Applied cookie: ${cookie.name}`);
      } catch (error) {
        console.warn(`Failed to set cookie ${cookie.name}:`, error.message);
      }
    }

    if (cookiesSet === 0) {
      throw new Error(
        "No cookies could be applied. Account may need to be re-added."
      );
    }

    console.log(`Applied ${cookiesSet} authentication cookies`);

    // Navigate to Instagram again to use the cookies, with retry logic
    console.log("Reloading Instagram with authentication...");
    report("auth_reload", "Verifying authentication...", 40);
    let authLoaded = false;
    for (let attempt = 1; attempt <= 2 && !authLoaded; attempt++) {
      try {
        await page.goto("https://www.instagram.com/", {
          waitUntil: "networkidle0",
          timeout: 35000,
        });
        authLoaded = true;
      } catch (err) {
        console.warn(
          `Attempt ${attempt} to reload Instagram with authentication failed: ${err.message}`
        );
        if (attempt === 2) throw err;
        await delay(2000);
      }
    }

    // Wait for page to fully load
    await delay(4000);

    // Check authentication status with more reliable selectors
    console.log("Verifying login status...");
    report("auth_check", "Checking login status...", 50);
    const authCheck = await page.evaluate(() => {
      // Look for login form elements (indicates NOT logged in)
      const loginForm =
        document.querySelector("form#loginForm") ||
        document.querySelector('input[name="username"]') ||
        document.querySelector('input[aria-label*="username"]');

      // Look for logged-in elements (indicates logged in)
      const loggedInElements = {
        newPost: document.querySelector('svg[aria-label="New post"]'),
        messages:
          document.querySelector('svg[aria-label="Messenger"]') ||
          document.querySelector('a[href*="/direct/"]'),
        home: document.querySelector('svg[aria-label="Home"]'),
        search: document.querySelector('svg[aria-label="Search"]'),
        profile: document.querySelector('img[alt*="profile picture"]'),
        settings: document.querySelector('[aria-label="Settings"]'),
      };

      const loggedInCount = Object.values(loggedInElements).filter(
        (el) => el !== null
      ).length;
      const hasLoginForm = !!loginForm;

      return {
        hasLoginForm,
        loggedInCount,
        loggedInElements: Object.fromEntries(
          Object.entries(loggedInElements).map(([key, el]) => [key, !!el])
        ),
        isLoggedIn: !hasLoginForm && loggedInCount >= 2,
      };
    });

    console.log("Authentication check results:", authCheck);

    if (authCheck.isLoggedIn) {
      console.log("✅ Successfully authenticated with Instagram!");
    } else if (authCheck.hasLoginForm) {
      console.error(
        "❌ Still seeing login form - cookies may be expired or invalid"
      );
      throw new Error(
        "Authentication failed - login form still visible. Please re-add your Instagram account."
      );
    } else {
      console.warn("⚠️ Authentication unclear - will attempt to continue");
    }

    console.log("Navigating to Instagram DM page...");
    report("navigate_dm", "Opening messaging interface...", 60);
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

    const basePerTarget = targetsArray.length ? 50 / targetsArray.length : 50;
    let targetIndex = 0;
    for (const target of targetsArray) {
      targetIndex++;
      const targetStartPercent = 45 + basePerTarget * (targetIndex - 1);
      report(
        "target_start",
        `Sending to ${target}...`,
        Math.min(95, targetStartPercent)
      );

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

          // Ensure we are on compose screen; avoid hard failure on NEWMESSAGEBUTTON selectors
          await ensureComposeScreen(page);

          // Try clicking NEW MESSAGE button only if present quickly; otherwise proceed (Instagram sometimes auto-opens compose)
          let clickedNewMessageButton = false;
          try {
            const newMessageButton = await waitForAnySelector(
              page,
              SELECTORS.NEWMESSAGEBUTTON,
              3000
            );
            if (newMessageButton) {
              await newMessageButton.click();
              clickedNewMessageButton = true;
              console.log("🆕 Clicked New Message button");
              await delay(800 + Math.random() * 600);
            }
          } catch (_) {
            console.log(
              "ℹ️ New Message button not found quickly; proceeding with existing compose view."
            );
          }

          // Locate search box with fallback attempts
          let searchBox;
          try {
            searchBox = await waitForAnySelector(
              page,
              SELECTORS.SEARCH_BOX,
              4000
            );
          } catch (e) {
            console.log(
              "Primary search box selectors failed; attempting fallback selector strategies."
            );
            const fallbackSelectors = [
              'input[placeholder="Search..."]',
              'input[aria-label*="Search"]',
              'input[placeholder*="Search"]',
              'input[dir="auto"][type="text"]',
            ];
            try {
              searchBox = await waitForAnySelector(
                page,
                fallbackSelectors,
                4000
              );
            } catch (e2) {
              throw new Error("Search box not found for composing new DM");
            }
          }

          await searchBox
            .click({ clickCount: 3 })
            .catch(() => searchBox.click());
          await page.keyboard.press("Backspace").catch(() => {});
          await delay(400 + Math.random() * 400);
          await searchBox.type(target, {
            delay: getRandomDelay(DELAYS.TYPING.min, DELAYS.TYPING.max),
          });
          await delay(1200 + Math.random() * 600);

          const results = await waitForAnySelector(
            page,
            SELECTORS.SEARCH_RESULTS
          ).catch(() => null);
          if (results) {
            await results.click().catch(() => {});
          } else {
            // Attempt XPath exact match fallback
            const xpathHandles = await page.$x(`//div[text() = '${target}']`);
            if (xpathHandles.length) {
              await xpathHandles[0].click();
            } else {
              throw new Error("Could not locate search result for target user");
            }
          }

          const chatButtons = await page.$$('div[role="button"]');
          for (const btn of chatButtons) {
            try {
              const text = await btn.evaluate((el) => el?.innerText?.trim());
              if (text === "Chat") {
                await btn.click();
                break;
              }
            } catch (_) {}
          }

          const messageBox = await waitForAnySelector(
            page,
            SELECTORS.MESSAGE_BOX
          );
          // Human-like typing (character delays already applied). Add pre-send pause.
          await messageBox.type(message, {
            delay: getRandomDelay(DELAYS.TYPING.min, DELAYS.TYPING.max),
          });
          // Pause before sending to mimic reading / quick review
          await delay(1200 + Math.random() * 1200);
          await page.keyboard.press("Enter", { delay: 80 });
          console.log(`Message sent to ${target}`);
          messagesSent++;
          consecutiveErrors = 0; // Reset consecutive errors on successful send

          const afterSendPercent = Math.min(
            95,
            targetStartPercent + basePerTarget * 0.7
          );
          report(
            "message_sent",
            `✓ Message sent to ${target}`,
            afterSendPercent,
            { target }
          );
          // Record message sent in CRM
          recordInteraction(contact.id, "dm_sent", message, campaignId);

          // Prepare for next target (lightweight navigation)
          if (targetIndex < targetsArray.length) {
            try {
              console.log("🔄 Preparing compose screen for next DM...");
              await ensureComposeScreen(page);
            } catch (navErr) {
              console.warn(
                "⚠️ Compose navigation issue, will attempt reuse:",
                navErr.message
              );
            }
          }

          // Check for response (temporarily disabled due to navigation timeouts)
          // TODO: Re-enable once Instagram selectors are updated

          const hasResponse = await checkForResponse(page, target);
          if (hasResponse) {
            responseCount++;
            if (selectedVariationIndex !== -1) {
              variationStats[selectedVariationIndex].responses++;
            }
            // Record response in CRM
            recordInteraction(contact.id, "dm_received", "Received response");
          }

          console.log(`DM to ${target} completed successfully.`);
          report(
            "target_complete",
            `✓ Completed ${target}`,
            Math.min(95, targetStartPercent + basePerTarget),
            { target }
          );
          success = true;
        } catch (error) {
          console.error(`Error with ${target}: ${error.message}`);
          report(
            "target_error",
            `⚠ Error with ${target}`,
            targetStartPercent,
            { target, error: error.message }
          );
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
            // removed selector failure phrase to avoid misclassification
            rateLimitHits++;
            consecutiveErrors++;
            console.log(
              `⚠️ Potential rate limit detected (hit ${rateLimitHits}/${MAX_RATE_LIMIT_RETRIES}, consecutive errors: ${consecutiveErrors}): ${error.message}`
            );

            // Refresh the page to reset the Instagram interface
            console.log(
              "🔄 Refreshing Instagram DM page to reset interface..."
            );
            await page.goto("https://www.instagram.com/direct/inbox/", {
              waitUntil: "networkidle2",
              timeout: 30000,
            });
            await delay(5000);

            // Exponential backoff based on consecutive errors and rate limit hits
            const backoffMultiplier = Math.pow(
              2,
              Math.min(consecutiveErrors - 1, 4)
            ); // Cap at 16x
            const baseDelay =
              rateLimitHits >= MAX_RATE_LIMIT_RETRIES
                ? DELAYS.RATE_LIMIT_PAUSE * 3
                : DELAYS.RATE_LIMIT_PAUSE;
            const backoffDelay = baseDelay * backoffMultiplier;

            console.log(
              `⏳ Exponential backoff: ${backoffDelay / 1000}s (base: ${baseDelay / 1000}s × ${backoffMultiplier})`
            );
            await delay(backoffDelay);

            // If we hit too many consecutive errors, stop the entire process
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              console.log(
                `🛑 Stopping due to ${consecutiveErrors} consecutive errors. Instagram may be heavily rate limiting.`
              );
              report(
                "error",
                `Stopped due to excessive rate limiting after ${consecutiveErrors} consecutive errors`,
                100
              );
              throw new Error(
                `Too many consecutive rate limit errors (${consecutiveErrors}). Stopping to prevent account restrictions.`
              );
            }

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
      console.log(`Waiting ${Math.round(pause / 1000)}s before next DM...`);
      await delay(pause);
    }
    report(
      "finish",
      `✅ Campaign complete! Sent ${messagesSent} messages`,
      100,
      {
        messagesSent,
      }
    );
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
    try {
      if (global.metrics)
        global.metrics.dmErrors = (global.metrics.dmErrors || 0) + 1;
    } catch (_) {}
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
    try {
      await browser?.close();
    } catch (_) {}
  }
}

// Check for response by navigating to the conversation with the target (still uses username for DM thread URL)
async function checkForResponse(page, target) {
  try {
    await page.goto(`https://www.instagram.com/direct/t/${target}`, {
      waitUntil: "networkidle2",
      timeout: 10000,
    });
    await delay(2000);
    const theirMessages = await page.$$eval(
      ".message-from-them",
      (msgs) => msgs.length
    );
    return theirMessages > 0;
  } catch (error) {
    console.warn("Error checking for response (non-critical):", error.message);
    return false;
  }
}

module.exports = { sendDMs };
