const express = require("express");
const cors = require("cors");
const { scrapeInbox, sendDMs } = require("./sendDMs");
const accountsStore = require("./accountsStore");
const targetsStore = require("./targetsStore");
require("dotenv").config();
const { ApifyClient } = require("apify-client");

const app = express();
const PORT = 5000;
const apifyClient = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// Test route for Puppeteer login
app.post("/api/send-dm", async (req, res) => {
  const { username, password, usernames, message } = req.body;
  try {
    await sendDMs({
      igUsername: username,
      igPassword: password,
      usernames,
      message,
    });
    res.json({
      status: "success",
      message: "Logged into Instagram (Puppeteer ran)",
    });
  } catch (err) {
    console.error("Puppeteer error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to log in to Instagram",
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

app.get("/api/inbox/:username", async (req, res) => {
  try {
    const username = req.params.username;
    console.log("Fetching inbox for:", username);

    // Validate account and cookies first
    const account = accountsStore.getAccountByUsername(username);
    if (!account || !account.cookies) {
      return res.status(401).json({
        status: "error",
        message: "Account not found or not logged in. Please log in first.",
      });
    }

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Inbox fetch timed out")), 300000); // 5 minute timeout
    });

    const fetchPromise = scrapeInbox(username);
    const conversations = await Promise.race([fetchPromise, timeoutPromise]);

    console.log(
      `Found ${conversations ? conversations.length : 0} conversations`
    );

    if (!conversations || conversations.length === 0) {
      return res.json({
        status: "success",
        conversations: [],
        message: "No messages found in inbox",
      });
    }

    res.json({
      status: "success",
      conversations,
      message: null,
    });
  } catch (err) {
    console.error("Inbox error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
      error: true,
    });
  }
});

app.post("/api/reply", async (req, res) => {
  const { username, threadId, message } = req.body;
  if (!username || !threadId || !message) {
    return res.status(400).json({ status: "error", message: "Missing fields" });
  }
  try {
    // Use Puppeteer to send a reply in the given thread
    const account = accountsStore.getAccountByUsername(username);
    if (!account || !account.cookies)
      throw new Error("No cookies for this account");
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--start-maximized"],
    });
    const page = await browser.newPage();
    await page.setCookie(...account.cookies);
    await page.goto(`https://www.instagram.com${threadId}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for page to be fully loaded
    await page.waitForTimeout(3000);

    // Try multiple selectors for the DM message input
    const messageSelectors = [
      "textarea",
      'input[aria-label="Message..."]',
      'div[role="textbox"]',
    ];
    let messageBoxFound = false;
    for (const selector of messageSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        await page.type(selector, message, { delay: 50 });
        messageBoxFound = true;
        break;
      } catch (e) {}
    }
    if (!messageBoxFound) throw new Error("DM message input not found");
    // Try to click the Send button
    let sendButtonFound = false;
    try {
      await page.waitForSelector('div[role="button"]', { timeout: 5000 });
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll('div[role="button"]')
        );
        const sendBtn = buttons.find(
          (btn) =>
            btn.innerText && btn.innerText.trim().toLowerCase() === "send"
        );
        if (sendBtn) sendBtn.click();
      });
      sendButtonFound = true;
    } catch (e) {}
    if (!sendButtonFound) {
      await browser.close();
      throw new Error("Send button not found");
    }
    await browser.close();
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

const puppeteer = require("puppeteer");
app.get("/api/leads", async (req, res) => {
  const { account, hashtag } = req.query;
  if (!account || !hashtag) {
    return res
      .status(400)
      .json({ status: "error", message: "Missing account or hashtag" });
  }
  try {
    const acc = accountsStore.getAccountByUsername(account);
    if (!acc || !acc.cookies) throw new Error("No cookies for this account");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setCookie(...acc.cookies);
    await page.goto(
      `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`,
      { waitUntil: "networkidle2", timeout: 30000 }
    );
    await page.waitForTimeout(3000);
    // Scrape post links
    const postLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="/p/"]')).map((a) =>
        a.getAttribute("href")
      )
    );
    const leads = [];
    for (const link of postLinks.slice(0, 15)) {
      try {
        await page.goto(`https://www.instagram.com${link}`, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await page.waitForTimeout(1000);
        const username = await page.evaluate(() => {
          const el = document.querySelector('header a[role="link"]');
          return el ? el.textContent : null;
        });
        if (username && !leads.find((l) => l.username === username)) {
          leads.push({ username });
        }
      } catch (e) {}
    }
    await browser.close();
    res.json({ status: "success", leads });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/scrape", async (req, res) => {
  const { postUrl, limit } = req.body;
  if (!postUrl)
    return res
      .status(400)
      .json({ status: "error", message: "Missing post URL" });
  try {
    console.log("[SCRAPE] Fetching comments for post:", postUrl);
    const run = await apifyClient
      .actor("apify/instagram-comment-scraper")
      .call({
        directUrls: [postUrl],
        searchLimit: 100,
        resultsLimit: 1,
        resultsType: "ownerUsername",
        expandOwners: true,
        includeComments: true,
        commentsLimit: 100,
        maxRequestsPerCrawl: 100,
      });

    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems();
    console.log("[SCRAPE] Received response from Apify dataset");
    console.log("[SCRAPE] Number of items:", items ? items.length : 0);
    console.log(
      "[SCRAPE] Raw items structure:",
      JSON.stringify(items, null, 2)
    );
    if (!items || items.length === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "No comments found" });
    }
    // Extract all username values from all comments (including duplicates)
    let allUsernames = [];
    let debugInfo = [];
    items.forEach((item, index) => {
      console.log(`[SCRAPE] Processing item ${index + 1}/${items.length}`);
      console.log(`[SCRAPE] Item structure:`, JSON.stringify(item, null, 2));

      const debugEntry = {
        itemIndex: index,
        fields: {
          ownerUsername: item.ownerUsername,
          owner: item.owner ? item.owner.username : undefined,
        },
      };
      debugInfo.push(debugEntry);

      // Each item is a comment, try to get the username
      if (item.ownerUsername && typeof item.ownerUsername === "string") {
        console.log(
          `[SCRAPE] Found username in ownerUsername: ${item.ownerUsername}`
        );
        allUsernames.push(item.ownerUsername);
      } else if (
        item.owner &&
        item.owner.username &&
        typeof item.owner.username === "string"
      ) {
        console.log(
          `[SCRAPE] Found username in owner.username: ${item.owner.username}`
        );
        allUsernames.push(item.owner.username);
      }
    });

    console.log(
      "[SCRAPE] Debug info for username fields:",
      JSON.stringify(debugInfo, null, 2)
    );
    console.log("[SCRAPE] All usernames found:", allUsernames);

    // Remove empty/falsey usernames
    allUsernames = allUsernames.filter(Boolean);
    console.log("[SCRAPE] Filtered usernames:", allUsernames);

    res.json({
      status: "success",
      usernames: allUsernames,
      debug: debugInfo,
    });
  } catch (err) {
    console.error("Scrape error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});
// --- TARGETS API ---
app.get("/api/targets", (req, res) => {
  // Return the list of saved usernames (targets)
  const targets = targetsStore.loadTargets();
  res.json({ status: "success", targets });
});

app.post("/api/targets", (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res
      .status(400)
      .json({ status: "error", message: "Missing username" });
  }
  const targets = targetsStore.addTarget(username);
  res.json({ status: "success", targets });
});

app.delete("/api/targets/:username", (req, res) => {
  const username = req.params.username;
  const targets = targetsStore.removeTarget(username);
  res.json({ status: "success", targets });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
