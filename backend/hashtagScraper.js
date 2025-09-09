const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { delay } = require("./utils/delay");
const { AccountsService } = require("./database");

puppeteer.use(StealthPlugin());

/**
 * Scrape usernames from Instagram hashtag page
 * @param {string} hashtag - The hashtag to scrape (with or without #)
 * @param {string} igUsername - Instagram account username for authentication
 * @param {number} maxPosts - Maximum number of posts to scrape (1-10, default 10)
 * @returns {Promise<string[]>} Array of usernames
 */
async function scrapeHashtag(hashtag, igUsername, maxPosts = 10) {
  // Validate and limit maxPosts
  maxPosts = Math.min(Math.max(parseInt(maxPosts) || 10, 1), 10);

  console.log(`Starting hashtag scrape for: #${hashtag}`);
  console.log(`Using account: ${igUsername} for authentication`);
  console.log(`Max posts limit: ${maxPosts}`);

  // Get account and validate cookies
  console.log(`Looking up account: ${igUsername}`);
  const account = await AccountsService.getAccountByUsername(igUsername);
  console.log(
    `Account found:`,
    account ? `Yes (has cookies: ${!!account.cookies})` : "No"
  );

  if (!account) {
    throw new Error(
      `Account ${igUsername} not found in database. Please add the account first.`
    );
  }

  if (!account.cookies) {
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

  console.log(
    `Found ${parsedCookies.length} cookies for account ${igUsername}`
  );

  let browser;
  try {
    console.log("Launching Puppeteer browser...");
    browser = await puppeteer.launch({
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

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    console.log("Loading Instagram...");
    await page.goto("https://www.instagram.com/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    console.log("Setting authentication cookies...");
    console.log(`Found ${parsedCookies.length} existing cookies`);

    // Set cookies with proper formatting
    for (const cookie of parsedCookies) {
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
        console.log(`✓ Applied cookie: ${cookie.name}`);
      } catch (error) {
        console.log(`✗ Failed to set cookie ${cookie.name}:`, error.message);
      }
    }

    console.log(`Applied ${parsedCookies.length} authentication cookies`);

    console.log("Reloading Instagram with authentication...");
    await page.goto("https://www.instagram.com/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Verify authentication
    console.log("Verifying login status...");
    const isLoggedIn = await page.evaluate(() => {
      const selectors = [
        'svg[aria-label="New post"]',
        'svg[aria-label="Direct"]',
        'svg[aria-label="Find People"]',
        'svg[aria-label="Activity Feed"]',
        'a[href="/direct/inbox/"]',
        'a[href*="/explore/"]',
      ];

      let loggedInCount = 0;
      const results = {};

      selectors.forEach((selector, index) => {
        const element = document.querySelector(selector);
        const found = !!element;
        if (found) loggedInCount++;

        const key = [
          "newPost",
          "messages",
          "explore",
          "activity",
          "direct",
          "search",
        ][index];
        results[key] = found;
      });

      return {
        hasLoginForm: !!document.querySelector('input[name="username"]'),
        loggedInCount,
        loggedInElements: results,
        isLoggedIn: loggedInCount >= 2,
      };
    });

    console.log("Authentication check results:", isLoggedIn);

    if (!isLoggedIn.isLoggedIn) {
      throw new Error(
        "Failed to authenticate with Instagram. Please check your login credentials."
      );
    }

    console.log("✅ Successfully authenticated with Instagram!");

    // Clean hashtag (remove # if present)
    const cleanHashtag = hashtag.replace(/^#/, "").trim();

    // Navigate to hashtag page
    const hashtagUrl = `https://www.instagram.com/explore/tags/${cleanHashtag}/`;
    console.log(`Navigating to hashtag: ${hashtagUrl}`);
    await page.goto(hashtagUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for content to load
    await delay(3000);

    // Check if hashtag page loaded correctly
    const pageTitle = await page.title();
    if (
      pageTitle.includes("Page Not Found") ||
      pageTitle.includes("Instagram")
    ) {
      // Page might be restricted or not found, try to continue anyway
      console.log(
        "Hashtag page may be restricted, attempting to scrape anyway..."
      );
    }

    console.log("Starting to collect post URLs from hashtag page...");

    // Step 1: Collect post URLs from the page by scrolling (up to maxPosts limit)
    const postUrls = new Set();
    let scrollAttempts = 0;
    const maxScrollAttempts = 30;
    let lastUrlCount = 0;
    let stableCount = 0;

    while (scrollAttempts < maxScrollAttempts && postUrls.size < maxPosts) {
      const urlsOnPage = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href^="/p/"]')).map((a) =>
          a.getAttribute("href")
        )
      );

      urlsOnPage.forEach((url) => postUrls.add(url));

      console.log(
        `Scroll ${scrollAttempts + 1}: Found ${urlsOnPage.length} post links. Total unique URLs: ${postUrls.size}/${maxPosts}`
      );

      if (postUrls.size >= maxPosts) {
        console.log(
          `Reached maxPosts limit of ${maxPosts}. Stopping URL collection.`
        );
        break;
      }

      if (postUrls.size === lastUrlCount) {
        stableCount++;
        if (stableCount >= 5) {
          console.log(
            "No new post URLs found in last 5 scrolls. Stopping URL collection."
          );
          break;
        }
      } else {
        stableCount = 0;
        lastUrlCount = postUrls.size;
      }

      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await delay(2000 + Math.random() * 1000);
      scrollAttempts++;
    }

    console.log(
      `Collected ${postUrls.size} unique post URLs. Now scraping each post.`
    );

    // Step 2: Visit each post and scrape usernames
    const usernames = new Set();
    const collectedUrls = Array.from(postUrls).slice(0, maxPosts); // Ensure we don't exceed maxPosts

    for (let i = 0; i < collectedUrls.length; i++) {
      const postUrl = collectedUrls[i];
      console.log(
        `(${i + 1}/${collectedUrls.length}) Navigating to post: ${postUrl}`
      );

      try {
        await page.goto(`https://www.instagram.com${postUrl}`, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await delay(3000);

        // Try to close any modal that might be open
        try {
          await page.waitForSelector('[aria-label="Close"]', { timeout: 5000 });
          console.log("Clicking close button if it exists...");
          await page.click('[aria-label="Close"]');
          await delay(1000);
        } catch (error) {
          console.log("No close button found, continuing...");
        }

        // Look for comments section and try to expand it
        console.log("Looking for comments section...");

        // Wait a bit more for the page to fully load
        await delay(3000);

        // Try to find and click on comments section to focus it
        try {
          const commentSelectors = [
            'svg[aria-label*="Comment"]',
            'button[aria-label*="Comment"]',
            'a[href*="#comments"]',
            'span:contains("View all")',
            'span:contains("comments")',
          ];

          for (const selector of commentSelectors) {
            try {
              const element = await page.$(selector);
              if (element) {
                await element.click();
                console.log(
                  `Clicked comments section with selector: ${selector}`
                );
                await delay(2000);
                break;
              }
            } catch (e) {
              continue;
            }
          }
        } catch (error) {
          console.log("Could not click into comments section");
        }

        // Wait for the post/comments container to load
        console.log("Waiting for page content to load...");
        let commentsContainer = null;
        const containerSelectors = ["main", '[role="main"]', "section"];

        for (const selector of containerSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 });
            commentsContainer = selector;
            console.log(`✓ Found container using selector: ${selector}`);
            break;
          } catch (error) {
            console.log(
              `✗ Container selector ${selector} not found, trying next...`
            );
            continue;
          }
        }

        if (!commentsContainer) {
          console.log(
            "No container found, proceeding with basic page scraping..."
          );
        }

        // Wait a moment for content to load
        await delay(3000);

        // Extract all visible usernames from the page using the same logic as puppeteerScraper
        const postUsernames = await page.evaluate((containerSelector) => {
          const usernames = [];

          // Focus on comments-specific selectors
          const commentsSelectors = [
            // Direct comment username links
            'h3 a[href^="/"]', // Comment author names
            'h2 a[href^="/"]', // Comment author names
            // Links within comment containers
            'li a[href^="/"]', // If comments are in list items
            'div[role="button"] + span a[href^="/"]', // Username after action buttons
            // General username links but more targeted
            'a[href^="/"][role="link"]',
            // Broader username link selector
            'a[href^="/"]',
          ];

          // Create selectors based on found container
          let selectors;
          if (containerSelector) {
            selectors = commentsSelectors.map(
              (sel) => `${containerSelector} ${sel}`
            );
          } else {
            selectors = commentsSelectors;
          }

          selectors.forEach((selector) => {
            const elements = Array.from(document.querySelectorAll(selector));
            elements.forEach((element) => {
              let username = "";

              // Get username from href (more reliable)
              if (element.href) {
                const href = element.getAttribute("href");
                if (
                  href &&
                  href.startsWith("/") &&
                  href.length > 2 &&
                  // Must be a simple profile path like "/username" or "/username/"
                  /^\/[a-zA-Z0-9._]+\/?(\?.*)?$/.test(href)
                ) {
                  username = href.replace(/\/|\?.*$/g, "");
                }
              }

              // Fallback: Get username from text content but clean it
              if (
                !username &&
                element.textContent &&
                element.textContent.trim()
              ) {
                let textContent = element.textContent.trim();
                // Remove "Verified" suffix if present
                textContent = textContent.replace(/Verified$/, "").trim();
                if (textContent.length > 0) {
                  username = textContent;
                }
              }

              // Enhanced username validation
              if (
                username &&
                username.length >= 2 &&
                username.length < 30 &&
                // Basic character validation
                /^[a-zA-Z0-9._]+$/.test(username) &&
                // Filter out UI elements
                ![
                  "Instagram",
                  "Carousel",
                  "Clip",
                  "Privacy",
                  "Terms",
                  "Locations",
                  "Meta",
                  "Stories",
                  "Reels",
                  "Shop",
                  "IGTV",
                  "Home",
                  "Search",
                  "Explore",
                  "Direct",
                  "Profile",
                  "More",
                  "Create",
                  "Notifications",
                  "Activity",
                  "Settings",
                ].includes(username) &&
                // Filter out common words/actions
                ![
                  "View",
                  "Like",
                  "Reply",
                  "Follow",
                  "Following",
                  "Followers",
                  "Posts",
                  "Tagged",
                  "Saved",
                  "Close",
                  "Share",
                  "Copy",
                  "Report",
                  "Unfollow",
                  "Block",
                  "Restrict",
                  "Comment",
                  "Comments",
                  "Load",
                  "Show",
                  "Hide",
                ].includes(username) &&
                // Filter out time indicators and metrics
                !/^\d+[smhdwmy]?$/.test(username) &&
                !/^(View|Load|Show|See|Hide|Open|Close)/.test(username) &&
                // Filter out obviously non-username strings
                !username.includes("ago") &&
                !username.includes("like") &&
                !username.includes("comment") &&
                // Must contain at least one letter
                /[a-zA-Z]/.test(username) &&
                // Must be reasonable length
                username.length >= 3 &&
                // Additional check to avoid UI elements
                !/^(all|more|less|new|old|top|best)$/i.test(username)
              ) {
                usernames.push(username);
              }
            });
          });

          // Look for @mentions in comment text content
          const searchContainer = containerSelector
            ? document.querySelector(containerSelector)
            : document;
          if (searchContainer) {
            const commentTextElements = Array.from(
              searchContainer.querySelectorAll(
                'span, p, div[role="button"] + *'
              )
            );
            commentTextElements.forEach((element) => {
              const text = element.textContent || "";
              // Look for @mentions in comments
              const mentions = text.match(/@([a-zA-Z0-9._]{3,})/g);
              if (mentions) {
                mentions.forEach((mention) => {
                  const username = mention.substring(1); // Remove @
                  if (
                    username.length >= 3 &&
                    username.length < 30 &&
                    /^[a-zA-Z0-9._]+$/.test(username) &&
                    // Additional validation for mentions
                    !["instagram", "everyone", "mention", "tag"].includes(
                      username.toLowerCase()
                    )
                  ) {
                    usernames.push(username);
                  }
                });
              }
            });
          }

          return [...new Set(usernames)]; // Remove duplicates
        }, commentsContainer);

        let newFound = 0;
        postUsernames.forEach((u) => {
          if (!usernames.has(u)) {
            usernames.add(u);
            newFound++;
          }
        });

        console.log(
          `Scraped ${newFound} new usernames from this post. Total unique: ${usernames.size}`
        );
      } catch (error) {
        console.error(`Failed to process post ${postUrl}:`, error.message);
      }
    }

    const finalUsernames = Array.from(usernames);
    console.log(
      `✅ Hashtag scraping completed. Found ${finalUsernames.length} unique usernames`
    );

    return finalUsernames;
  } catch (error) {
    console.error("Error in hashtag scraping:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeHashtag };
