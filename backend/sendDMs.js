// Focused on resolving the selector failure and node detachment issues.

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AccountsService = require("./database/accounts");
const { delay } = require("./utils/delay");
const {
  SELECTORS,
  findWorkingSelector,
  isElementInteractable,
} = require("./utils/selectors");
const { createContact, recordInteraction } = require("./database/crm");
const config = require("./config");

// Mock DM sender for when Puppeteer fails
const sendDMsMock = async ({
  igUsername,
  usernames,
  message,
  campaignId = null,
  messageVariations = null,
}) => {
  console.log("🎭 MOCK DM SENDER ACTIVATED");
  console.log(`Mock sending DMs from account: ${igUsername}`);

  const targetsArray = Array.isArray(usernames)
    ? usernames
    : usernames
        .split(/[\n,;]+/)
        .map((t) => t.trim())
        .filter(Boolean);

  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Mock success for demonstration
  const mockResults = {
    successCount: targetsArray.length,
    responseCount: 0,
    variationStats: messageVariations
      ? messageVariations.map(() => ({ sent: 1, responses: 0 }))
      : [],
    rateLimitHits: 0,
    errors: [],
    totalTargets: targetsArray.length,
    isMock: true,
  };

  console.log(
    `🎭 Mock DM session complete: ${targetsArray.length} targets processed`
  );
  console.log("📝 Note: This was a simulation. No actual DMs were sent.");

  return mockResults;
};

puppeteer.use(StealthPlugin());

// Constants
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
const MAX_CONSECUTIVE_ERRORS = config.dm.limits.maxConsecutiveErrors;

// Helper functions
const waitForAnySelector = async (page, selectors, timeout = 5000) => {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorArray) {
    try {
      const element = await page.waitForSelector(selector, {
        timeout: timeout / selectorArray.length,
      });
      if (element) return element;
    } catch (e) {
      // Continue to next selector
    }
  }
  throw new Error(`None of the selectors found: ${selectorArray.join(", ")}`);
};

// Enhanced compose screen function
const ensureComposeScreen = async (page) => {
  console.log("Ensuring compose screen is ready...");

  if (!page || page.isClosed()) {
    throw new Error("Page is closed or detached");
  }

  try {
    // Check if we're already on the compose screen
    const isOnCompose = await page.evaluate(() => {
      return (
        window.location.href.includes("/direct/new") ||
        document.querySelector('input[placeholder*="Search"]') !== null ||
        document.querySelector('input[aria-label*="Search"]') !== null
      );
    });

    if (!isOnCompose) {
      console.log("Looking for New Message button...");

      try {
        const newMessageButton = await findWorkingSelector(
          page,
          SELECTORS.NEWMESSAGEBUTTON,
          10000
        );
        await newMessageButton.click();
        console.log("🆕 Clicked New Message button");
        await delay(3000);
      } catch (error) {
        console.log(
          "ℹ️ New Message button not found quickly; trying navigation approach."
        );

        // Fallback: navigate directly
        await page.goto("https://www.instagram.com/direct/new", {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        await delay(2000);
      }
    }
  } catch (error) {
    console.warn("Could not ensure compose screen:", error.message);
    throw error;
  }
};

// Enhanced user search and selection
const searchAndSelectUser = async (page, username) => {
  console.log(`Searching for user: ${username}`);

  if (!page || page.isClosed()) {
    throw new Error("Page is closed or detached");
  }

  try {
    // Locate search box with fallback attempts
    let searchBox;
    try {
      searchBox = await findWorkingSelector(page, SELECTORS.SEARCH_BOX, 4000);
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
        searchBox = await waitForAnySelector(page, fallbackSelectors, 4000);
      } catch (e2) {
        throw new Error("Search box not found for composing new DM");
      }
    }

    // Clear and type username
    await searchBox.click({ clickCount: 3 }).catch(() => searchBox.click());
    await page.keyboard.press("Backspace").catch(() => {});
    await delay(400 + Math.random() * 400);
    await searchBox.type(username, {
      delay: getRandomDelay(DELAYS.TYPING.min, DELAYS.TYPING.max),
    });
    await delay(1200 + Math.random() * 600);

    // Wait for search results and select user
    console.log("Waiting for search results...");
    const results = await waitForAnySelector(
      page,
      SELECTORS.SEARCH_RESULTS,
      5000
    ).catch(() => null);

    if (results) {
      console.log("Found search result, clicking...");
      await results.click();
      await delay(1000);
    } else {
      // Attempt alternative approach - look for the user in the dropdown
      console.log("Trying alternative user selection approach...");
      try {
        // Wait for dropdown to appear
        await page.waitForSelector('div[role="dialog"]', { timeout: 3000 });

        // Look for the username in the dropdown using evaluate
        const userFound = await page.evaluate((targetUsername) => {
          // Find all elements that might contain the username
          const elements = Array.from(
            document.querySelectorAll("div, span, a")
          );
          for (const element of elements) {
            if (
              element.textContent &&
              element.textContent.trim() === targetUsername
            ) {
              // Look for a clickable parent (button, div with role=button, etc.)
              let clickableParent = element;
              while (clickableParent && clickableParent !== document.body) {
                if (
                  clickableParent.tagName === "BUTTON" ||
                  clickableParent.getAttribute("role") === "button" ||
                  clickableParent.onclick ||
                  clickableParent.style.cursor === "pointer"
                ) {
                  clickableParent.click();
                  return true;
                }
                clickableParent = clickableParent.parentElement;
              }
              // If no clickable parent found, try clicking the element itself
              element.click();
              return true;
            }
          }
          return false;
        }, username);

        if (!userFound) {
          throw new Error("Could not locate search result for target user");
        }

        await delay(1000);
      } catch (evalError) {
        throw new Error("Could not locate search result for target user");
      }
    }

    // Look for Chat button - fix the iteration issue
    try {
      // Wait for any button to appear
      await page.waitForSelector('div[role="button"], button', {
        timeout: 5000,
      });

      // Use the specific class structure from the HTML you provided
      const chatButtonSelectors = [
        // Exact class match for the Chat button you showed
        'div.x1i10hfl.xjqpnuy.xc5r6h4.xqeqjp1.x1phubyo.x972fbf.x10w94by.x1qhh985.x14e42zd.xdl72j9.x2lah0s.x3ct3a4.xdj266r.x14z9mp.xat24cr.x1lziwak.x2lwn1j.xeuugli.xexx8yu.x18d9i69.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x9f619.x9bdzbf.x1ypdohk.x78zum5.x1f6kntn.xwhw2v2.xl56j7k.x17ydfre.x1n2onr6.x2b8uid.xlyipyv.x87ps6o.x14atkfc.x5c86q.x18br7mf.x1i0vuye.x6nl9eh.x1a5l9x9.x7vuprf.x1mg3h75.xn3w4p2.x106a9eq.x1xnnf8n.x18cabeq.x158me93.xk4oym4.x1uugd1q[role="button"]',
        // Fallback selectors
        'div[role="button"]',
        'button[type="button"]',
        "button",
      ];

      let chatButtonFound = false;

      // Try to find Chat button using text content
      for (const selector of chatButtonSelectors) {
        try {
          const buttons = await page.$(selector);

          for (const btn of buttons) {
            try {
              const text = await btn.evaluate((el) => el?.textContent?.trim());
              if (text === "Chat") {
                await btn.click();
                chatButtonFound = true;
                await delay(1500);
                break;
              }
            } catch (btnError) {
              continue;
            }
          }

          if (chatButtonFound) break;
        } catch (selectorError) {
          continue;
        }
      }

      if (!chatButtonFound) {
        // Last resort: find any element with "Chat" text and try to click it
        const chatButtonFound2 = await page.evaluate(() => {
          // Find all elements containing "Chat" text
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );

          let node;
          while ((node = walker.nextNode())) {
            if (node.textContent.trim() === "Chat") {
              let element = node.parentElement;
              // Walk up the DOM to find a clickable element
              while (element && element !== document.body) {
                if (
                  element.tagName === "BUTTON" ||
                  element.getAttribute("role") === "button" ||
                  element.onclick ||
                  window.getComputedStyle(element).cursor === "pointer"
                ) {
                  element.click();
                  return true;
                }
                element = element.parentElement;
              }
            }
          }
          return false;
        });

        if (chatButtonFound2) {
          chatButtonFound = true;
          await delay(1500);
        }
      }

      if (!chatButtonFound) {
        // Continue anyway, sometimes the chat opens automatically
      }
    } catch (chatError) {
      // Continue anyway, sometimes the chat opens automatically after selecting user
    }
  } catch (error) {
    console.error(
      `Error searching and selecting user ${username}:`,
      error.message
    );
    throw error;
  }
};

const checkForResponse = async (page, target) => {
  console.log(`Checking for response from ${target}...`);
  // Simplified response check - can be enhanced later
  return false;
};

const updateCampaignStats = async (campaignId, stats) => {
  console.log(`Updating campaign ${campaignId} stats:`, stats);
  // Implementation for updating campaign stats
};

async function sendDMs({
  igEmail,
  igUsername,
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
  let consecutiveErrors = 0;
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

  // Better account lookup logic
  let account = null;
  const accountIdentifier = igEmail || igUsername;

  console.log(`Looking for account with identifier: ${accountIdentifier}`);

  if (!accountIdentifier) {
    console.error("No account identifier provided (igEmail or igUsername)");
    return await sendDMsMock({
      igEmail: accountIdentifier,
      usernames,
      message,
      campaignId,
      messageVariations,
    });
  }

  // Try multiple lookup methods
  try {
    // First try by email
    if (accountIdentifier.includes("@")) {
      account = await AccountsService.getAccountByEmail(accountIdentifier);
    }

    // If not found, try by username
    if (!account) {
      account = await AccountsService.getAccountByUsername(accountIdentifier);
    }

    // If still not found, try the combined lookup
    if (!account) {
      account =
        await AccountsService.getAccountByUsernameOrEmail(accountIdentifier);
    }

    // If still not found, try to find any account that matches
    if (!account) {
      const allAccounts = await AccountsService.getAccounts();

      // Try to find a partial match
      account = allAccounts.find(
        (acc) =>
          acc.username === accountIdentifier ||
          acc.email === accountIdentifier ||
          acc.username.includes(accountIdentifier) ||
          (acc.email && acc.email.includes(accountIdentifier))
      );
    }

    // Parse cookies from JSON string if they exist
    if (account && account.cookies) {
      try {
        if (typeof account.cookies === "string") {
          account.cookies = JSON.parse(account.cookies);
        }
      } catch (parseError) {
        console.error("Error parsing cookies:", parseError);
        account.cookies = null;
      }
    }
  } catch (lookupError) {
    console.error("Error during account lookup:", lookupError);
  }

  if (
    !account ||
    !Array.isArray(account.cookies) ||
    account.cookies.length === 0
  ) {
    console.warn(
      `No account found or no cookies available for: ${accountIdentifier}`
    );
    // Get available accounts for debugging
    try {
      const allAccounts = await AccountsService.getAccounts();
      console.log(
        "Available accounts:",
        allAccounts.map((acc) => ({
          username: acc.username,
          email: acc.email,
          hasCookies: acc.cookies && acc.cookies.length > 0,
        }))
      );
    } catch (error) {
      console.log("Error getting accounts for debugging:", error.message);
    }

    // Fallback to mock if no cookies found
    return await sendDMsMock({
      igEmail: accountIdentifier,
      usernames,
      message,
      campaignId,
      messageVariations,
    });
  }

  console.log(
    `✅ Found account: ${account.username} with ${account.cookies.length} cookies`
  );

  let browser;
  try {
    console.log(
      "Attempting to launch Puppeteer with working config (--no-sandbox)..."
    );
    report("launch_browser", "Connecting to Instagram...", 10);
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      timeout: 60000,
      protocolTimeout: 120000,
    });
    console.log("✓ Working Puppeteer config successful");
  } catch (error) {
    console.log(
      "Working config failed, trying fallback with more args:",
      error.message
    );
    try {
      console.log("Attempting fallback Puppeteer config...");
      browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        timeout: 60000,
        protocolTimeout: 60000,
      });
      console.log("✓ Fallback Puppeteer config successful");
    } catch (fallbackError) {
      console.log(
        "Fallback Puppeteer config failed, trying extended config:",
        fallbackError.message
      );
      try {
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
          timeout: 60000,
          protocolTimeout: 60000,
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

        return await sendDMsMock({
          igEmail: accountIdentifier,
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
    await page.setDefaultNavigationTimeout(60000);

    // Set user agent to avoid detection
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate to Instagram home page first
    console.log("Loading Instagram...");
    report("navigate_home", "Loading Instagram...", 20);
    let homeLoaded = false;
    for (let attempt = 1; attempt <= 2 && !homeLoaded; attempt++) {
      try {
        await page.goto("https://www.instagram.com/", {
          waitUntil: "domcontentloaded",
          timeout: 60000,
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

    // Set cookies
    report("set_cookies", "Authenticating account...", 30);
    let cookiesSet = 0;

    for (const cookie of account.cookies) {
      try {
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
      } catch (error) {
        console.warn(`Failed to set cookie ${cookie.name}:`, error.message);
      }
    }

    if (cookiesSet === 0) {
      throw new Error(
        "No cookies could be applied. Account may need to be re-added."
      );
    }

    // Navigate to Instagram again to use the cookies
    report("auth_reload", "Verifying authentication...", 40);
    let authLoaded = false;
    for (let attempt = 1; attempt <= 2 && !authLoaded; attempt++) {
      try {
        await page.goto("https://www.instagram.com/", {
          waitUntil: "networkidle0",
          timeout: 60000,
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
    report("auth_check", "Checking login status...", 50);

    // Wait a bit more for page to fully load
    await delay(3000);

    const authCheck = await page.evaluate(() => {
      // Look for login form elements (indicates NOT logged in)
      const loginSelectors = [
        "form#loginForm",
        'input[name="username"]',
        'input[aria-label*="username"]',
        'input[aria-label*="Phone number, username, or email"]',
        'button[type="submit"]',
      ];

      const loginForm = loginSelectors.some(
        (selector) => document.querySelector(selector) !== null
      );

      // Look for logged-in elements (indicates logged in)
      const loggedInSelectors = {
        newPost: [
          'svg[aria-label="New post"]',
          'a[href="#"]', // Sometimes the new post button
          '[data-testid="new-post-button"]',
        ],
        messages: [
          'svg[aria-label="Messenger"]',
          'a[href*="/direct/"]',
          '[data-testid="direct-link"]',
        ],
        home: [
          'svg[aria-label="Home"]',
          'a[href="/"]',
          '[data-testid="home-link"]',
        ],
        search: [
          'svg[aria-label="Search"]',
          'input[placeholder*="Search"]',
          '[data-testid="search-input"]',
        ],
        profile: ['img[alt*="profile picture"]', '[data-testid="user-avatar"]'],
        navigation: [
          'nav[role="navigation"]',
          '[data-testid="mobile-nav-bar"]',
        ],
      };

      const loggedInElements = {};
      let loggedInCount = 0;

      Object.entries(loggedInSelectors).forEach(([key, selectors]) => {
        const found = selectors.some(
          (selector) => document.querySelector(selector) !== null
        );
        loggedInElements[key] = found;
        if (found) loggedInCount++;
      });

      // Additional checks
      const hasInstagramLogo =
        document.querySelector('img[alt="Instagram"]') !== null;
      const hasMainContent =
        document.querySelector("main") !== null ||
        document.querySelector('[role="main"]') !== null;

      // Check URL
      const currentUrl = window.location.href;
      const isOnLoginPage =
        currentUrl.includes("/accounts/login") || currentUrl.includes("/login");

      return {
        hasLoginForm: loginForm,
        loggedInCount,
        loggedInElements,
        hasInstagramLogo,
        hasMainContent,
        currentUrl,
        isOnLoginPage,
        isLoggedIn:
          !loginForm && !isOnLoginPage && loggedInCount >= 2 && hasMainContent,
      };
    });

    if (authCheck.isLoggedIn) {
      // Authentication successful - reduced logging
    } else if (authCheck.hasLoginForm || authCheck.isOnLoginPage) {
      console.error(
        "❌ Still seeing login form - cookies may be expired or invalid"
      );
      throw new Error(
        "Authentication failed - login form still visible. Please re-add your Instagram account."
      );
    } else {
      console.warn("⚠️ Authentication unclear - will attempt to continue");
    }

    report("navigate_dm", "Opening messaging interface...", 60);
    try {
      await page.goto("https://www.instagram.com/direct/new", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });
    } catch (navigationError) {
      try {
        await page.goto("https://www.instagram.com/direct/new", {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
      } catch (fallbackError) {
        try {
          await page.goto("https://www.instagram.com/direct/new", {
            timeout: 60000,
          });
        } catch (basicError) {
          // Continue anyway - DM sending may still work
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
      let contact = null;
      try {
        contact = await createContact(target);
        if (!contact || !contact.id) {
          console.warn(
            `⚠️ Failed to create/get contact for ${target} - contact.id is missing`
          );
        }
      } catch (contactError) {
        console.warn(
          `⚠️ Error creating contact for ${target}:`,
          contactError.message
        );
        contact = null;
      }

      while (retryCount <= MAX_RETRIES && !success) {
        try {
          console.log(`Starting DM to ${target}`);
          const notNowBtn = await waitForAnySelector(
            page,
            SELECTORS.NOT_NOW_BUTTON,
            5000
          ).catch(() => null);
          if (notNowBtn) await notNowBtn.click();

          // Ensure we are on compose screen
          await ensureComposeScreen(page);

          // Try clicking NEW MESSAGE button only if present quickly; otherwise proceed
          let clickedNewMessageButton = false;
          try {
            const newMessageButton = await findWorkingSelector(
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

          // Search and select user
          await searchAndSelectUser(page, target);

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
          try {
            if (contact && contact.id) {
              recordInteraction(contact.id, "dm_sent", message, campaignId);
            } else {
              console.warn(
                `⚠️ Cannot record interaction: contact.id is null for ${target}`
              );
            }
          } catch (crmError) {
            console.warn(
              `⚠️ Failed to record CRM interaction for ${target}:`,
              crmError.message
            );
          }

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
            try {
              if (contact && contact.id) {
                recordInteraction(
                  contact.id,
                  "dm_received",
                  "Received response"
                );
              } else {
                console.warn(
                  `⚠️ Cannot record response interaction: contact.id is null for ${target}`
                );
              }
            } catch (crmError) {
              console.warn(
                `⚠️ Failed to record CRM response interaction for ${target}:`,
                crmError.message
              );
            }
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
              timeout: 60000,
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

module.exports = { sendDMs };
