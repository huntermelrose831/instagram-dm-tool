const express = require("express");
const cors = require("cors");
const { sendDMs } = require("./sendDMs");
const puppeteer = require("puppeteer");

const accountsStore = require("./accountsStore");
const targetsStore = require("./targetsStore");
const app = express();
const PORT = 5000;
require("dotenv").config();
const { ApifyClient } = require("apify-client");

// Custom delay function using Promise
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const apifyClient = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

app.post("/api/send-dms", async (req, res) => {
  const { username, usernames, message, useApify } = req.body;

  try {
    if (!username || !usernames || !message) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields: username, usernames, or message",
      });
    }

    if (useApify) {
      const account = accountsStore.getAccountByUsername(username);
      const sessionCookie = account?.cookies?.find(
        (c) => c.name === "sessionid"
      );

      if (!sessionCookie) {
        return res.status(400).json({
          status: "error",
          message: "Session ID not found for selected account",
        });
      }
      console.log(req.body);

      console.log("Received usernames:", usernames);
      console.log("Type of usernames:", typeof usernames);

      return res.json({
        status: "success",
        message: "Messages sent successfully via Apify",
      });
    } else {
      await sendDMs({
        igUsername: username,
        usernames,
        message,
      });

      return res.json({
        status: "success",
        message: "Messages sent successfully via Puppeteer",
      });
    }
  } catch (err) {
    console.error("DM sending error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to send DMs",
      error: err.message,
    });
  }
});

app.post("/api/add-account", async (req, res) => {
  const { username, password } = req.body;
  try {
    // Launch Puppeteer, login, and save cookies
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
    });
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2" }),
    ]);
    // Check for login success
    let loginSuccess = false;
    try {
      await page.waitForSelector('svg[aria-label="New post"]', {
        timeout: 15000,
      });
      loginSuccess = true;
    } catch (e) {}
    if (!loginSuccess) {
      await browser.close();
      return res.status(401).json({ status: "error", message: "Login failed" });
    }
    // Save cookies
    const cookies = await page.cookies();
    accountsStore.upsertAccount({ username, cookies });
    await browser.close();
    res.json({ status: "success", message: "Account added and cookies saved" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/accounts", (req, res) => {
  res.json(
    accountsStore.loadAccounts().map((acc) => ({ username: acc.username }))
  );
});

app.delete("/api/accounts/:username", (req, res) => {
  accountsStore.removeAccount(req.params.username);
  res.json({ status: "success" });
});

app.post("/api/scrape/accounts", async (req, res) => {
  const { postUrl } = req.body;
  console.log("Starting scrape for account URL:", postUrl);

  try {
    const usernameMatch = postUrl.match(/instagram\.com\/([^\/\?]+)/);
    if (!usernameMatch) throw new Error("Invalid profile URL");

    const username = usernameMatch[1];

    // Get saved cookies for authentication
    const account = accountsStore.loadAccounts()[0]; // Use first available account
    if (!account || !account.cookies) {
      throw new Error(
        "No authenticated Instagram account found. Please add an account first."
      );
    }

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Set the saved cookies
    await page.setCookie(...account.cookies);
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "networkidle2",
    });

    // Wait for the followers count to be visible
    await page.waitForSelector('a[href$="/followers/"]', { timeout: 5000 });

    // Click the followers link and wait for modal
    await page.click('a[href$="/followers/"]');
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(2000); // Give some time for followers to load

    const followers = new Set();

    // Keep retrying until we find the modal
    const modal = await page.waitForSelector(
      'div[role="dialog"] div > div > div:nth-child(2)',
      {
        timeout: 5000,
      }
    );

    if (!modal) {
      throw new Error("Could not find followers modal");
    }

    let lastHeight = 0;

    while (followers.size < 30) {
      // Wait for items to load
      await page.waitForSelector('div[role="dialog"] a[href^="/"]', {
        timeout: 5000,
      });

      const newFollowers = await page.evaluate(() => {
        const anchors = Array.from(
          document.querySelectorAll('div[role="dialog"] a[href^="/"]')
        );
        return anchors.map((a) => a.getAttribute("href").replace(/\//g, ""));
      });

      newFollowers.forEach((f) => followers.add(f));

      await page.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      }, modal);

      await page.waitForTimeout(2000);

      const currentHeight = await page.evaluate((el) => el.scrollHeight, modal);
      if (currentHeight === lastHeight) break;
      lastHeight = currentHeight;
    }

    await browser.close();

    const leads = Array.from(followers)
      .slice(0, 15)
      .map((username) => ({
        username,
        profileUrl: `https://instagram.com/${username}`,
        timestamp: new Date().toISOString(),
      }));

    console.log("Processed leads:", leads);
    res.json({ status: "success", leads });
  } catch (err) {
    console.error("Error scraping leads:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Endpoint to scrape comments from a post
app.post("/api/scrape/posts", async (req, res) => {
  try {
    const { postUrl } = req.body;
    console.log("Starting scrape for URL:", postUrl);

    if (!process.env.APIFY_TOKEN) {
      throw new Error("APIFY_TOKEN is not set in environment variables");
    } // Run the Instagram scraper actor
    console.log("Starting Apify actor with Instagram comment scraper...");

    // Prepare Actor input
    const input = {
      directUrls: [postUrl],
      resultsLimit: 20,
    };
    console.log("Actor input:", input);

    // Run the Actor and wait for it to finish
    const run = await apifyClient
      .actor("apify/instagram-comment-scraper")
      .call(input);
    console.log("Run completed, dataset ID:", run.defaultDatasetId);
    console.log(
      `💾 Results available at: https://console.apify.com/storage/datasets/${run.defaultDatasetId}`
    );

    // Get the dataset
    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems();
    console.log("Got items:", JSON.stringify(items, null, 2)); // Process the results
    console.log("Processing items:", items);
    let leads = [];
    if (items && items.length > 0) {
      leads = items
        .map((item) => ({
          username: item.ownerUsername, // Changed to ownerUsername as per Apify's format
          profileUrl: `https://instagram.com/${item.ownerUsername}`,
          comment: item.text || "",
          timestamp: item.timestamp || new Date().toISOString(),
        }))
        .filter(
          (lead, index, self) =>
            // Remove duplicates
            index === self.findIndex((l) => l.username === lead.username)
        )
        .slice(0, 15); // Limit to 15 results
    }

    console.log("Processed leads:", leads);
    res.json({
      status: "success",
      leads,
    });
  } catch (error) {
    console.error("Error scraping leads:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to scrape leads",
    });
  }
});
// Endpoint to scrape comments from a hashtag
app.post("/api/scrape/hashtags", async (req, res) => {
  try {
    const { postUrl } = req.body;
    console.log("Starting scrape for URL:", postUrl);

    if (!process.env.APIFY_TOKEN) {
      throw new Error("APIFY_TOKEN is not set in environment variables");
    }

    // Extract hashtag from URL or direct input
    const hashtag = postUrl.replace(/^#/, "").trim();

    // Prepare Actor input
    const input = {
      hashtags: [hashtag],
      resultsLimit: 20,
    };
    console.log("Actor input:", input);

    // Run the Actor and wait for it to finish
    const run = await apifyClient
      .actor("apify/instagram-hashtag-scraper")
      .call(input);
    console.log("Run completed, dataset ID:", run.defaultDatasetId);

    // Get the dataset
    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems();

    let leads = [];
    if (items && items.length > 0) {
      // Extract usernames from posts
      leads = items
        .map((item) => ({
          username: item.ownerUsername,
          profileUrl: `https://instagram.com/${item.ownerUsername}`,
          timestamp: item.timestamp || new Date().toISOString(),
        }))
        .filter((lead) => lead.username) // Remove any undefined usernames
        .filter(
          (lead, index, self) =>
            // Remove duplicates
            index === self.findIndex((l) => l.username === lead.username)
        )
        .slice(0, 15); // Limit to 15 results
    }

    console.log("Processed leads:", leads);
    res.json({
      status: "success",
      leads,
    });
  } catch (error) {
    console.error("Error scraping leads:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to scrape leads",
    });
  }
});
// Target usernames endpoints
app.get("/api/targets", (req, res) => {
  try {
    const targets = targetsStore.loadTargets();
    res.json({ status: "success", targets });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/targets", (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res
        .status(400)
        .json({ status: "error", message: "Username is required" });
    }
    const targets = targetsStore.addTarget(username);
    res.json({ status: "success", targets });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.delete("/api/targets/:username", (req, res) => {
  try {
    const targets = targetsStore.removeTarget(req.params.username);
    res.json({ status: "success", targets });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
