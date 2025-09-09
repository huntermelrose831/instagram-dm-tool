const puppeteer = require("puppeteer");
const AccountsService = require("./database/accounts");
const { delay } = require("./utils/delay");

/**
 * Scrapes followers from an Instagram profile using authenticated session
 * @param {string} profileUrl - The Instagram profile URL to scrape followers from
 * @param {string} igUsername - The Instagram username of the account to use for authentication
 * @returns {Promise<Array>} Array of follower usernames
 */
async function scrapeFollowers(profileUrl, igUsername) {
  console.log(`Starting follower scrape for: ${profileUrl}`);
  console.log(`Using account: ${igUsername} for authentication`);

  // Get account and validate cookies
  const account = await AccountsService.getAccountByUsername(igUsername);
  if (!account?.cookies) {
    throw new Error(
      `No cookies found for account ${igUsername}. Please log in first.`
    );
  }

  // Parse cookies if stored as JSON string
  let parsedCookies = null;
  try {
    parsedCookies =
      typeof account.cookies === "string"
        ? JSON.parse(account.cookies)
        : account.cookies;
  } catch (parseError) {
    console.error(
      `Error parsing cookies for account ${igUsername}:`,
      parseError
    );
    throw new Error(
      `Invalid cookie format for account ${igUsername}. Please log in again.`
    );
  }

  if (!Array.isArray(parsedCookies) || parsedCookies.length === 0) {
    throw new Error(
      `No valid cookies found for account ${igUsername}. Please log in again.`
    );
  }

  let browser;
  try {
    // Launch browser with your preferred configuration
    console.log("Launching Puppeteer browser...");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      timeout: 30000,
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30000);

    // Set user agent to avoid detection (same as sendDMs.js)
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/91.0.4472.124 Safari/537.36"
    );

    // Navigate to Instagram home page first
    console.log("Loading Instagram...");
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

    // Set cookies for authentication (same logic as sendDMs.js)
    console.log("Setting authentication cookies...");
    let cookiesSet = 0;
    const currentCookies = await page.cookies();
    console.log(`Found ${currentCookies.length} existing cookies`);

    for (const cookie of parsedCookies) {
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

    // Navigate to Instagram again to use the cookies
    console.log("Reloading Instagram with authentication...");
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

    // Check authentication status (same logic as sendDMs.js)
    console.log("Verifying login status...");
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

    // Now navigate to the target profile URL
    console.log(`Navigating to profile: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Handle close button if it exists
    try {
      await page.waitForSelector('[aria-label="Close"]', { timeout: 5000 });
      console.log("Clicking close button if it exists...");
      await page.click('[aria-label="Close"]');
      await delay(1000);
    } catch (error) {
      console.log("No close button found, continuing...");
    }

    // Wait for and click followers button with multiple selector attempts
    console.log("Looking for followers button...");

    const followersSelectors = [
      'a[href*="/followers/"]', // Direct link to followers
      "li:nth-child(2) > div > button > span", // Original selector
      "header section ul li:nth-child(2) a", // Alternative header layout
      'div[data-testid="user-followers-count"]', // Test ID selector
      'a[href$="/followers/"]', // Link ending with followers
      "li:nth-child(2) a", // Simplified list item
      'button:has-text("followers")', // Button containing "followers" text
      'span:has-text("followers")', // Span containing "followers" text
      'a:has-text("followers")', // Link containing "followers" text
    ];

    let followersButton = null;
    let selectorUsed = null;

    for (const selector of followersSelectors) {
      try {
        console.log(`Trying selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 3000 });
        followersButton = await page.$(selector);
        if (followersButton) {
          selectorUsed = selector;
          console.log(`✓ Found followers button with selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`✗ Selector ${selector} not found`);
        continue;
      }
    }

    if (!followersButton) {
      // Fallback: try to find by text content
      console.log("Trying text-based search for followers button...");
      try {
        followersButton = await page.evaluateHandle(() => {
          // Look for elements containing "followers" text
          const elements = Array.from(document.querySelectorAll("*"));
          for (const element of elements) {
            const text = element.textContent?.toLowerCase() || "";
            if (
              text.includes("followers") &&
              (element.tagName === "A" ||
                element.tagName === "BUTTON" ||
                element.tagName === "SPAN")
            ) {
              return element;
            }
          }
          return null;
        });

        if (followersButton && followersButton.asElement()) {
          selectorUsed = "text-based search";
          console.log("✓ Found followers button using text search");
        }
      } catch (error) {
        console.log("✗ Text-based search failed");
      }
    }

    if (!followersButton || !followersButton.asElement()) {
      throw new Error("Could not find followers button on profile page");
    }

    console.log(`Clicking followers button (using ${selectorUsed})...`);
    await followersButton.click();

    // Wait for followers modal to load
    console.log("Waiting for followers modal to load...");
    await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
    await delay(3000); // Give time for initial followers to load

    // Enhanced scraping logic with scrolling and collection
    console.log("Starting follower collection...");
    const followers = new Set();
    let scrollAttempts = 0;
    const maxScrollAttempts = 100; // Limit scrolling attempts
    let lastFollowerCount = 0;
    let stableCount = 0;

    while (scrollAttempts < maxScrollAttempts) {
      // Extract current followers
      const currentFollowers = await page.evaluate(() => {
        const followerElements = Array.from(
          document.querySelectorAll('div[role="dialog"] a[href^="/"]')
        );
        return followerElements
          .map((element) => {
            const href = element.getAttribute("href");
            const username = href ? href.replace(/\//g, "") : "";
            return username;
          })
          .filter((username) => username && username !== "");
      });

      // Add new followers to our set
      currentFollowers.forEach((username) => followers.add(username));

      console.log(`Found ${followers.size} unique followers so far...`);

      // Check if we're getting new followers
      if (followers.size === lastFollowerCount) {
        stableCount++;
        if (stableCount >= 5) {
          console.log("No new followers found after 5 attempts, stopping...");
          break;
        }
      } else {
        stableCount = 0;
        lastFollowerCount = followers.size;
      }

      // Scroll down in the modal
      await page.evaluate(() => {
        const modal = document.querySelector(
          'div[role="dialog"] div > div > div:nth-child(2)'
        );
        if (modal) {
          modal.scrollTop = modal.scrollHeight;
        }
      });

      // Wait for new content to load
      await delay(2000);
      scrollAttempts++;

      // Stop if we have a good number of followers
      if (followers.size >= 200) {
        console.log("Reached 200 followers, stopping collection...");
        break;
      }
    }

    console.log(`Collection complete! Found ${followers.size} total followers`);

    // Convert Set to Array for return
    const followerArray = Array.from(followers);

    await browser.close();
    return followerArray;
  } catch (error) {
    console.error("Error in follower scraping:", error);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn("Error closing browser:", closeError.message);
      }
    }
    throw error;
  }
}

module.exports = { scrapeFollowers };
