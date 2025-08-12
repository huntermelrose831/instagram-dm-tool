const express = require("express");
const cors = require("cors");
const { sendDMs } = require("./sendDMs");
const puppeteer = require("puppeteer");
const { initializeScheduler, RATE_LIMITS } = require("./scheduler");
const accountsStore = require("./accountsStore");
const targetsStore = require("./targetsStore");
const { scrapeProduct } = require('./puppeteerScraper');
// Import follower scraper
const { scrapeFollowers } = require('./followerScraper');
// Import hashtag and keyword scrapers
const { scrapeHashtag } = require('./hashtagScraper');
const { scrapeKeyword } = require('./keywordScraper');

// Import all database services
const {
  updateDMRateLimits,
  getDMStats,
  scheduleDM,
  getScheduledJobs,
  createContact,
  getContacts,
  updateContactStatus,
  recordInteraction,
  LeadsService,
  AccountsService,
  ScrapingService,
  ProxyService,
  RateLimitService,
} = require("./database");

// Import ratelimits for counter resets
const ratelimits = require("./database/ratelimits.js");

// Import message monitoring system
const { messageMonitor } = require("./messageMonitor");

const app = express();
const PORT = 5000;
require("dotenv").config();

// Custom delay function using Promise
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// Initialize the scheduler when the server starts
initializeScheduler();

app.post("/api/send-dms", async (req, res) => {
  try {
    const {
      username,
      usernames,
      message,
      scheduled,
      scheduleTime,
      messageVariations,
    } = req.body;

    console.log("=== /api/send-dms REQUEST ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    if (
      !username ||
      !usernames ||
      (!message && (!messageVariations || messageVariations.length === 0))
    ) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields",
        details: { username, usernames, message, messageVariations },
      });
    }

    // Handle scheduling
    if (scheduled && scheduleTime) {
      console.log("Scheduling DM for later execution...");
      console.log("Schedule time received:", scheduleTime);

      // Use messageVariations if provided, otherwise use the single message
      const variations =
        messageVariations && messageVariations.length > 0
          ? messageVariations
          : [message];

      try {
        const jobId = await scheduleDM({
          fromUsername: username,
          targetUsernames: usernames,
          messageVariations: variations,
          scheduleTime: scheduleTime, // Pass the datetime-local string directly
          isRecurring: false,
          recurringInterval: null,
        });

        return res.json({
          status: "success",
          message: "DM scheduled successfully",
          jobId,
          scheduledFor: scheduleTime,
        });
      } catch (scheduleError) {
        console.error("Error scheduling DM:", scheduleError);
        return res.status(500).json({
          status: "error",
          message: "Failed to schedule DM: " + scheduleError.message,
        });
      }
    } else {
      // Send immediately
      console.log("Sending DM immediately...");
      await sendDMs({
        igUsername: username,
        usernames,
        message,
      });

      return res.json({
        status: "success",
        message: "Messages sent successfully",
      });
    }
  } catch (err) {
    console.error("DM sending error:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Failed to send DMs",
    });
  }
});

app.post("/api/add-account", async (req, res) => {
  const { username, password } = req.body;
  try {
    // Launch Puppeteer, login, and save cookies
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
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

app.get("/api/accounts", async (req, res) => {
  try {
    const accounts = AccountsService.getAccounts();
    res.json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/accounts", async (req, res) => {
  try {
    const { username, email, password, proxy, dailyLimit, notes } = req.body;

    const accountData = {
      username,
      email,
      passwordHash: password, // In production, hash this password
      proxyId: proxy ? parseInt(proxy) : null,
      isActive: true,
    };

    const account = AccountsService.upsertAccount(accountData);
    res.json({
      status: "success",
      message: "Account created successfully",
      account,
    });
  } catch (error) {
    console.error("Error creating account:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Login to Instagram and save cookies
app.post("/api/accounts/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        status: "error",
        message: "Username and password are required"
      });
    }

    // Check if account exists in database
    const account = AccountsService.getAccountByUsername(username);
    if (!account) {
      return res.status(404).json({
        status: "error",
        message: "Account not found. Please add the account first."
      });
    }

    console.log(`Starting Instagram login process for ${username}...`);
    
    // Import and run the login function
    const { loginAndSaveCookies } = require('./login');
    const result = await loginAndSaveCookies(username, password);

    if (result.success) {
      res.json({
        status: "success",
        message: "Successfully logged in and saved cookies to Instagram"
      });
    } else {
      res.status(500).json({
        status: "error",
        message: "Login failed - please check your credentials"
      });
    }

  } catch (error) {
    console.error("Error during Instagram login:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Login process failed"
    });
  }
});

app.put("/api/accounts/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const updates = req.body;

    const accountData = {
      username,
      email: updates.email,
      passwordHash: updates.password,
      proxyId: updates.proxy ? parseInt(updates.proxy) : null,
      isActive: updates.isActive !== undefined ? updates.isActive : true,
    };

    const account = AccountsService.upsertAccount(accountData);
    res.json({
      status: "success",
      message: "Account updated successfully",
      account,
    });
  } catch (error) {
    console.error("Error updating account:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.delete("/api/accounts/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const success = AccountsService.deleteAccount(username);

    if (success) {
      // Also remove from old accountsStore for backward compatibility
      accountsStore.removeAccount(username);
      res.json({ status: "success", message: "Account deleted successfully" });
    } else {
      res.status(404).json({ status: "error", message: "Account not found" });
    }
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Additional endpoint to delete by account ID (for frontend compatibility)
app.delete("/api/accounts/id/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = parseInt(id);
    
    // Get all accounts to find the one with matching ID
    const accounts = AccountsService.getAccounts();
    const accountToDelete = accounts.find(account => account.id === accountId);
    
    if (!accountToDelete) {
      return res.status(404).json({ status: "error", message: "Account not found" });
    }
    
    const success = AccountsService.deleteAccount(accountToDelete.username);

    if (success) {
      // Also remove from old accountsStore for backward compatibility
      accountsStore.removeAccount(accountToDelete.username);
      res.json({ status: "success", message: "Account deleted successfully" });
    } else {
      res.status(404).json({ status: "error", message: "Account not found" });
    }
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/scrape/accounts", async (req, res) => {
  const { postUrl, igUsername } = req.body;
  console.log("Starting scrape for account URL:", postUrl);
  console.log("Using Instagram account:", igUsername);

  try {
    if (!postUrl || typeof postUrl !== "string") {
      throw new Error("Missing or invalid profile URL");
    }

    if (!igUsername || typeof igUsername !== "string") {
      throw new Error("Missing Instagram username for authentication");
    }

    // Extract username from URL for validation
    const usernameMatch = postUrl.match(/instagram\.com\/([^\/\?]+)/);
    if (!usernameMatch || !usernameMatch[1]) {
      throw new Error("Invalid Instagram profile URL");
    }

    const targetUsername = usernameMatch[1];
    console.log(`Scraping followers for: ${targetUsername} using account: ${igUsername}`);

    // Use the new follower scraper with authentication
    const followers = await scrapeFollowers(postUrl, igUsername);

    // Convert to leads format
    const leads = followers.map((followerUsername) => ({
      username: followerUsername,
      profileUrl: `https://instagram.com/${followerUsername}`,
      timestamp: new Date().toISOString(),
    }));

    // Store leads in database
    let storedCount = 0;
    leads.forEach((lead) => {
      try {
        LeadsService.addLead({
          username: lead.username,
          profileUrl: lead.profileUrl,
          source: "instagram_followers",
          sourceUrl: postUrl,
          scrapedAt: lead.timestamp,
        });
        storedCount++;
      } catch (error) {
        console.error(`Error storing lead ${lead.username}:`, error);
      }
    });

    console.log(`Processed ${storedCount} leads from ${targetUsername}'s followers`);
    res.json({ 
      status: "success", 
      leads,
      totalFound: followers.length,
      totalStored: storedCount,
      message: `Successfully scraped ${storedCount} followers from ${targetUsername} using account ${igUsername}` 
    });

  } catch (err) {
    console.error("Error scraping leads:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Endpoint to scrape comments from a post
app.post("/api/scrape/posts", async (req, res) => {
  try {
    const { postUrl, igUsername } = req.body;
    console.log("Starting scrape for URL:", postUrl);
    console.log("Using account:", igUsername);

    if (!igUsername) {
      return res.status(400).json({ error: "Instagram username is required for authentication" });
    }

    // Use your own Puppeteer scraper with authentication
    const usernames = await scrapeProduct(postUrl, igUsername);
    console.log("Scraped usernames:", usernames);

    // Optionally store leads in database
    usernames.forEach((username) => {
      try {
        LeadsService.addLead({
          username,
          profileUrl: `https://instagram.com/${username}`,
          source: "instagram_post_comments",
          sourceUrl: postUrl,
          scrapedAt: new Date().toISOString(),
          notes: "",
        });
      } catch (error) {
        console.error(`Error storing lead ${username}:`, error);
      }
    });

    // Return usernames directly for frontend display
    res.json({
      status: "success",
      usernames,
    });
  } catch (error) {
    console.error("Error scraping leads:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to scrape leads",
    });
  }
});
// Endpoint to scrape usernames from a hashtag using Puppeteer
app.post("/api/scrape/hashtags", async (req, res) => {
  try {
    const { postUrl, igUsername, maxPosts } = req.body;
    console.log("Starting hashtag scrape for:", postUrl);
    console.log("Using Instagram account:", igUsername);
    console.log("Max posts:", maxPosts);

    // Validate inputs
    if (!postUrl || typeof postUrl !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Missing or invalid hashtag input"
      });
    }

    // Use default account if none specified, or get first available account
    let accountToUse = igUsername;
    if (!accountToUse) {
      const accounts = AccountsService.getAccounts();
      if (accounts.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "No Instagram accounts available. Please add an account first."
        });
      }
      accountToUse = accounts[0].username;
      console.log("No account specified, using first available:", accountToUse);
    }

    // Extract hashtag from input (remove # if present)
    const hashtag = postUrl.replace(/^#/, "").trim();
    
    if (!hashtag) {
      return res.status(400).json({
        status: "error",
        message: "Invalid hashtag input"
      });
    }

    console.log(`Scraping hashtag: #${hashtag} using account: ${accountToUse}`);

    // Use the new Puppeteer-based hashtag scraper
    const usernames = await scrapeHashtag(hashtag, accountToUse, maxPosts);

    // Convert to leads format
    const leads = usernames.map((username) => ({
      username: username,
      profileUrl: `https://instagram.com/${username}`,
      timestamp: new Date().toISOString(),
    }));

    // Store leads in database
    let storedCount = 0;
    leads.forEach((lead) => {
      try {
        LeadsService.addLead({
          username: lead.username,
          profileUrl: lead.profileUrl,
          source: "instagram_hashtag",
          sourceUrl: `#${hashtag}`,
          scrapedAt: lead.timestamp,
        });
        storedCount++;
      } catch (error) {
        console.error(`Error storing lead ${lead.username}:`, error);
      }
    });

    console.log(`Processed ${storedCount} leads from hashtag #${hashtag}`);
    res.json({
      status: "success",
      leads,
      totalFound: usernames.length,
      totalStored: storedCount,
      message: `Successfully scraped ${storedCount} usernames from hashtag #${hashtag}`
    });
  } catch (error) {
    console.error("Error scraping hashtag:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to scrape hashtag",
    });
  }
});
// Endpoint to scrape usernames from keyword search using Puppeteer
app.post("/api/scrape/keywords", async (req, res) => {
  try {
    const { postUrl: keywords, igUsername, maxPosts } = req.body;
    console.log("Starting keyword search for:", keywords);
    console.log("Using Instagram account:", igUsername);
    console.log("Max posts:", maxPosts);

    // Validate inputs
    if (!keywords || typeof keywords !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Missing or invalid keywords input"
      });
    }

    // Use default account if none specified, or get first available account
    let accountToUse = igUsername;
    if (!accountToUse) {
      const accounts = AccountsService.getAccounts();
      if (accounts.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "No Instagram accounts available. Please add an account first."
        });
      }
      accountToUse = accounts[0].username;
      console.log("No account specified, using first available:", accountToUse);
    }

    console.log(`Searching for keywords: "${keywords}" using account: ${accountToUse}`);

    // Use the new Puppeteer-based keyword scraper
    const usernames = await scrapeKeyword(keywords, accountToUse, maxPosts);

    // Convert to leads format
    const leads = usernames.map((username) => ({
      username: username,
      profileUrl: `https://instagram.com/${username}`,
      timestamp: new Date().toISOString(),
    }));

    // Store leads in database
    let storedCount = 0;
    leads.forEach((lead) => {
      try {
        LeadsService.addLead({
          username: lead.username,
          profileUrl: lead.profileUrl,
          source: "instagram_keyword_search",
          sourceUrl: keywords,
          scrapedAt: lead.timestamp,
          notes: `Found via keyword search: ${keywords}`,
        });
        storedCount++;
      } catch (error) {
        console.error(`Error storing lead ${lead.username}:`, error);
      }
    });

    console.log(`Processed ${storedCount} leads from keyword search: "${keywords}"`);
    res.json({
      status: "success",
      leads,
      totalFound: usernames.length,
      totalStored: storedCount,
      message: `Successfully found ${storedCount} usernames for keywords: "${keywords}"`
    });
  } catch (error) {
    console.error("Error searching keywords:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to search keywords",
    });
  }
});

// Target usernames endpoints - Use targetsStore for targets.json
app.get("/api/targets", async (req, res) => {
  try {
    const targets = targetsStore.loadTargets();
    res.json({ status: "success", targets });
  } catch (err) {
    console.error("Error fetching targets:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/targets", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res
        .status(400)
        .json({ status: "error", message: "Username is required" });
    }

    // Add lead if it doesn't exist, then mark as target
    let lead = LeadsService.getLeadByUsername(username);
    if (!lead) {
      lead = LeadsService.addLead({
        username,
        profileUrl: `https://instagram.com/${username}`,
        source: "manual",
        isTarget: true,
      });
    } else {
      LeadsService.updateLead(lead.id, { isTarget: true });
    }

    // Also add to old targetsStore for backward compatibility
    const targets = targetsStore.addTarget(username);
    res.json({ status: "success", targets, lead });
  } catch (err) {
    console.error("Error adding target:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.delete("/api/targets/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Remove from database
    const lead = LeadsService.getLeadByUsername(username);
    if (lead) {
      LeadsService.updateLead(lead.id, { isTarget: false });
    }

    // Also remove from old targetsStore for backward compatibility
    const targets = targetsStore.removeTarget(username);
    res.json({ status: "success", targets });
  } catch (err) {
    console.error("Error removing target:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Endpoint to schedule DMs
app.post("/api/schedule-dms", async (req, res) => {
  try {
    console.log("\n=== Scheduling new DM job ===");
    console.log("Received request at:", new Date().toISOString());
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      fromUsername,
      targetUsernames,
      messageVariations,
      scheduleTime,
      isRecurring,
      recurringInterval,
    } = req.body;

    // Validate required fields
    if (
      !fromUsername ||
      !targetUsernames ||
      !messageVariations ||
      !scheduleTime
    ) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields",
        details: {
          fromUsername,
          targetUsernames,
          messageVariations,
          scheduleTime,
        },
      });
    } // Clean the username to remove @ prefix if present
    const cleanFromUsername = fromUsername.replace(/^@/, "");

    console.log("TIMEZONE DEBUG - Scheduling with cleaned username:", {
      original: fromUsername,
      cleaned: cleanFromUsername,
      scheduleTime,
      targetCount: targetUsernames.length,
    });

    const jobId = await scheduleDM({
      fromUsername: cleanFromUsername,
      targetUsernames,
      messageVariations,
      scheduleTime,
      isRecurring,
      recurringInterval,
    });

    res.json({
      status: "success",
      message: "DM scheduled successfully",
      jobId,
    });
  } catch (err) {
    console.error("Error scheduling DMs:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Failed to schedule DMs",
    });
  }
});

// Endpoint to get DM stats and rate limits
app.get("/api/dm-stats/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const stats = await getDMStats(username);

    res.json({
      status: "success",
      stats: {
        ...stats,
        maxDMsPerDay: RATE_LIMITS.MAX_DMS_PER_DAY,
        remainingDMs: RATE_LIMITS.MAX_DMS_PER_DAY - (stats.daily_dm_count || 0),
      },
    });
  } catch (err) {
    console.error("Error fetching DM stats:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch DM stats",
      error: err.message,
    });
  }
});

// Endpoint to get all scheduled jobs
app.get("/api/scheduled-jobs", async (req, res) => {
  try {
    const jobs = await getScheduledJobs();
    res.json({
      status: "success",
      jobs,
    });
  } catch (err) {
    console.error("Error fetching scheduled jobs:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch scheduled jobs",
      error: err.message,
    });
  }
});

// Delete a scheduled job
app.delete("/api/scheduled-jobs/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`Attempting to cancel job ${jobId}`);

    // Import the updateJobStatus function
    const { updateJobStatus } = require("./database/messaging");

    // Update job status to cancelled
    await updateJobStatus(jobId, "cancelled");

    console.log(`Job ${jobId} cancelled successfully`);
    res.json({
      status: "success",
      message: "Job cancelled successfully",
    });
  } catch (err) {
    console.error("Error cancelling job:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to cancel job",
      error: err.message,
    });
  }
});

// Permanently delete a scheduled job
app.delete("/api/scheduled-jobs/:jobId/delete", async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`Attempting to permanently delete job ${jobId}`);

    // Import the deleteJob function from messaging
    const { deleteScheduledJob } = require("./database/messaging");

    // Permanently delete the job
    await deleteScheduledJob(jobId);

    console.log(`Job ${jobId} deleted successfully`);
    res.json({
      status: "success",
      message: "Job deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting job:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to delete job",
      error: err.message,
    });
  }
});

// Campaign Management Routes
app.get("/api/campaigns", async (req, res) => {
  try {
    const campaigns = await getCampaigns();
    res.json({ status: "success", campaigns });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/campaigns", async (req, res) => {
  try {
    const {
      name,
      account_username,
      message_variations,
      target_usernames,
      schedule_time,
      is_scheduled,
    } = req.body; // Validate the account exists
    const account = AccountsService.getAccountByUsername(account_username);
    if (!account) {
      return res.status(400).json({
        status: "error",
        message: "Selected account not found",
      });
    }

    const campaignId = await createCampaign({
      name,
      account_username,
      message_variations,
      target_usernames,
      schedule_time: is_scheduled ? schedule_time : null,
      is_scheduled,
    });

    res.json({
      status: "success",
      message: "Campaign created successfully",
      campaignId,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.patch("/api/campaigns/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await updateCampaignStatus(id, status);
    res.json({
      status: "success",
      message: "Campaign status updated successfully",
    });
  } catch (err) {
    console.error("Failed to update campaign status:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to update campaign status",
      error: err.message,
    });
  }
});

app.delete("/api/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteCampaign(id);
    res.json({
      status: "success",
      message: "Campaign deleted successfully",
    });
  } catch (err) {
    console.error("Failed to delete campaign:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to delete campaign",
      error: err.message,
    });
  }
});

// Launch campaign endpoint
app.post("/api/campaigns/:id/launch", async (req, res) => {
  try {
    const { id } = req.params;
    await updateCampaignStatus(id, "active");
    res.json({
      status: "success",
      message: "Campaign launched successfully",
    });
  } catch (err) {
    console.error("Failed to launch campaign:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to launch campaign",
      error: err.message,
    });
  }
});

// Pause campaign endpoint
app.post("/api/campaigns/:id/pause", async (req, res) => {
  try {
    const { id } = req.params;
    await updateCampaignStatus(id, "paused");
    res.json({
      status: "success",
      message: "Campaign paused successfully",
    });
  } catch (err) {
    console.error("Failed to pause campaign:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to pause campaign",
      error: err.message,
    });
  }
});

// Update campaign endpoint
app.put("/api/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Update campaign in database (you'll need to implement this function)
    // For now, we'll just update the status
    await updateCampaignStatus(id, updateData.status || "draft");

    res.json({
      status: "success",
      message: "Campaign updated successfully",
    });
  } catch (err) {
    console.error("Failed to update campaign:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to update campaign",
      error: err.message,
    });
  }
});

// Get campaign targets - Updated to use database service
app.get("/api/campaigns/:id/targets", async (req, res) => {
  try {
    const { id } = req.params;
    const targets = getCampaignTargets(id);
    res.json({ targets });
  } catch (err) {
    console.error("Failed to get campaign targets:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to get campaign targets",
      error: err.message,
    });
  }
});

// Add campaign target - Updated to use database service
app.post("/api/campaigns/:id/targets", async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        status: "error",
        message: "Username is required",
      });
    }

    const success = addCampaignTarget(id, username);

    if (success) {
      res.json({
        status: "success",
        message: "Target added successfully",
      });
    } else {
      res.status(400).json({
        status: "error",
        message: "Target already exists or campaign not found",
      });
    }
  } catch (err) {
    console.error("Failed to add campaign target:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to add campaign target",
      error: err.message,
    });
  }
});

// Remove campaign target - Updated to use database service
app.delete("/api/campaigns/:id/targets/:targetId", async (req, res) => {
  try {
    const { id, targetId } = req.params;

    const success = removeCampaignTarget(id, targetId);

    if (success) {
      res.json({
        status: "success",
        message: "Target removed successfully",
      });
    } else {
      res.status(404).json({
        status: "error",
        message: "Target not found",
      });
    }
  } catch (err) {
    console.error("Failed to remove campaign target:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to remove campaign target",
      error: err.message,
    });
  }
});

// Get campaign replies - Updated to use database service
app.get("/api/campaigns/:id/replies", async (req, res) => {
  try {
    const { id } = req.params;
    const replies = getCampaignReplies(id);
    res.json({ replies });
  } catch (err) {
    console.error("Failed to get campaign replies:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to get campaign replies",
      error: err.message,
    });
  }
});

// CRM Routes
app.get("/api/crm/contacts", async (req, res) => {
  try {
    const { status, tag } = req.query;
    const contacts = await getContacts({ status, tag });
    res.json({ status: "success", contacts });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/crm/contacts/:id/notes", async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const noteId = await addNote(id, note);
    res.json({ status: "success", noteId });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.patch("/api/crm/contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ status: "error", message: "Contact ID is required" });
    }
    if (!status) {
      return res
        .status(400)
        .json({ status: "error", message: "Status is required" });
    }

    const updatedContact = await updateContactStatus(id, status);
    if (!updatedContact) {
      return res
        .status(404)
        .json({ status: "error", message: "Contact not found" });
    }

    res.json({ status: "success", contact: updatedContact });
  } catch (error) {
    console.error("Error updating contact status:", error);
    res
      .status(error.message.includes("Invalid status") ? 400 : 500)
      .json({ status: "error", message: error.message });
  }
});

app.post("/api/crm/contacts/:id/tags", async (req, res) => {
  try {
    const { id } = req.params;
    const { tag } = req.body;
    await addTag(id, tag);
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.delete("/api/crm/contacts/:id/tags/:tag", async (req, res) => {
  try {
    const { id, tag } = req.params;
    await removeTag(id, tag);
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/crm/contacts/:id/interactions", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, content, campaignId } = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ status: "error", message: "Contact ID is required" });
    }
    if (!type || !content) {
      return res
        .status(400)
        .json({ status: "error", message: "Type and content are required" });
    }

    await recordInteraction(id, type, content, campaignId);
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error recording interaction:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Analytics Endpoints - Updated to use AnalyticsService
app.get("/api/analytics", async (req, res) => {
  try {
    // Support ?range=7d or ?start=YYYY-MM-DD&end=YYYY-MM-DD
    let startDate, endDate;
    if (req.query.start && req.query.end) {
      startDate = new Date(req.query.start);
      endDate = new Date(req.query.end);
    } else {
      const days = parseInt((req.query.range || "7d").replace(/[^0-9]/g, "")) || 7;
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
    }

    // Get comprehensive analytics
    const analyticsData = await analytics.getAnalytics(startDate, endDate);
    const peakTimes = analytics.getPeakResponseTimes();

    // Get recent activity (last 10 actions)
    let recentActivity = [];
    try {
      const db = require("./database/db");
      const stmt = db.prepare(`
        SELECT username, action_type, details, status, created_at
        FROM activity_logs
        ORDER BY created_at DESC
        LIMIT 10
      `);
      recentActivity = stmt.all();
    } catch (err) {
      console.error("Error fetching recent activity:", err);
    }

    res.json({
      ...analyticsData,
      peakTimes,
      recentActivity,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Dashboard Stats Endpoint - Updated to use analytics service
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const dashboardStats = analytics.getDashboardStats();

    // Get additional stats from the database
    const activeAccounts = AccountsService.getAccounts().filter(
      (a) => a.isActive
    ).length;

    res.json({
      activeJobs: dashboardStats.activeJobs || 0,
      completedToday: dashboardStats.completedToday || 0,
      successRate: dashboardStats.successRate || 0,
      activeAccounts: activeAccounts,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ============================================================
// SMART AUTOMATION ENDPOINTS
// ============================================================

// Get all automation rules
app.get("/api/automation/rules", async (req, res) => {
  try {
    const { active_only = "true" } = req.query;
    const rules = AutomationService.getAutomationRules(active_only === "true");
    res.json({
      status: "success",
      rules: rules,
    });
  } catch (error) {
    console.error("Error fetching automation rules:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Create new automation rule
app.post("/api/automation/rules", async (req, res) => {
  try {
    const ruleData = req.body;
    const result = AutomationService.createAutomationRule(ruleData);
    res.json({
      status: "success",
      message: "Automation rule created successfully",
      ruleId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error("Error creating automation rule:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Toggle automation rule active status
app.patch("/api/automation/rules/:id/toggle", async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const { is_active } = req.body;

    AutomationService.toggleAutomationRule(ruleId, is_active);
    res.json({
      status: "success",
      message: `Rule ${is_active ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling automation rule:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Delete automation rule
app.delete("/api/automation/rules/:id", async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    AutomationService.deleteAutomationRule(ruleId);
    res.json({
      status: "success",
      message: "Automation rule deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting automation rule:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Get follow-up sequences
app.get("/api/automation/sequences", async (req, res) => {
  try {
    const { active_only = "true" } = req.query;
    const sequences = AutomationService.getFollowupSequences(
      active_only === "true"
    );
    res.json({
      status: "success",
      sequences: sequences,
    });
  } catch (error) {
    console.error("Error fetching follow-up sequences:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/automation/sequences", async (req, res) => {
  try {
    const sequenceData = req.body;
    const result = AutomationService.createFollowupSequence(sequenceData);
    res.json({
      status: "success",
      message: "Follow-up sequence created successfully",
      sequenceId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error("Error creating follow-up sequence:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Analyze message sentiment
app.post("/api/automation/analyze-message", async (req, res) => {
  try {
    const { contact_id, message_text } = req.body;
    const analysis = AutomationService.analyzeMessage(contact_id, message_text);
    res.json({
      status: "success",
      analysis: analysis,
    });
  } catch (error) {
    console.error("Error analyzing message:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Get high-value leads
app.get("/api/automation/high-value-leads", async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const leads = AutomationService.getHighValueLeads(parseInt(limit));
    res.json({
      status: "success",
      leads: leads,
    });
  } catch (error) {
    console.error("Error fetching high-value leads:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Get automation metrics
app.get("/api/automation/metrics", async (req, res) => {
  try {
    const { timeframe = "30d" } = req.query;
    const metrics = AutomationService.getAutomationMetrics(timeframe);
    res.json({
      status: "success",
      metrics: metrics,
    });
  } catch (error) {
    console.error("Error fetching automation metrics:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Get rule performance
app.get("/api/automation/rules/performance", async (req, res) => {
  try {
    const performance = AutomationService.getRulePerformance();
    res.json({
      status: "success",
      performance: performance,
    });
  } catch (error) {
    console.error("Error fetching rule performance:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Get sequence performance
app.get("/api/automation/sequences/performance", async (req, res) => {
  try {
    const performance = AutomationService.getSequencePerformance();
    res.json({
      status: "success",
      performance: performance,
    });
  } catch (error) {
    console.error("Error fetching sequence performance:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Manual trigger automation for a contact
app.post("/api/automation/trigger", async (req, res) => {
  try {
    const { contact_id, message_text, rule_id } = req.body;

    if (rule_id) {
      // Trigger specific rule
      const rules = AutomationService.getAutomationRules();
      const rule = rules.find((r) => r.id === rule_id);
      if (rule) {
        const result = await AutomationService.executeAutomationRule(
          rule,
          contact_id,
          { manual: true }
        );
        res.json({
          status: "success",
          message: "Automation rule executed successfully",
          result: result,
        });
      } else {
        res.status(404).json({ status: "error", message: "Rule not found" });
      }
    } else {
      // Find and trigger matching rules
      const triggeredRules = AutomationService.getTriggeredRules(
        contact_id,
        message_text || ""
      );
      const results = [];

      for (const rule of triggeredRules) {
        try {
          const result = await AutomationService.executeAutomationRule(
            rule,
            contact_id,
            { manual: true }
          );
          results.push({ ruleId: rule.id, ruleName: rule.name, result });
        } catch (error) {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            error: error.message,
          });
        }
      }

      res.json({
        status: "success",
        message: `Triggered ${triggeredRules.length} automation rules`,
        results: results,
      });
    }
  } catch (error) {
    console.error("Error triggering automation:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Smart Automation Routes
app.get("/api/automation", async (req, res) => {
  try {
    // Mock automation data - replace with actual database queries
    const mockAutoResponders = [
      {
        id: 1,
        name: "Welcome Message",
        type: "auto-responder",
        isActive: true,
        priority: 1,
        triggers: [{ type: "first-message", value: "any" }],
        actions: [
          {
            type: "send-message",
            config: { message: "Thanks for reaching out! How can I help you?" },
          },
        ],
        executionCount: 45,
      },
      {
        id: 2,
        name: "Product Inquiry Response",
        type: "auto-responder",
        isActive: true,
        priority: 2,
        triggers: [
          { type: "keyword", value: "product" },
          { type: "keyword", value: "price" },
        ],
        actions: [
          {
            type: "send-message",
            config: {
              message:
                "I'd love to tell you about our products! Let me share some details.",
            },
          },
          { type: "add-to-crm", config: { tag: "product-interest" } },
        ],
        executionCount: 23,
      },
    ];

    const mockFollowUpSequences = [
      {
        id: 3,
        name: "Lead Nurturing Sequence",
        type: "follow-up-sequence",
        isActive: true,
        priority: 1,
        triggers: [{ type: "tag-added", value: "lead" }],
        actions: [
          {
            type: "schedule-follow-up",
            config: {
              delay: "1 day",
              message:
                "Hi! Just checking if you had any questions about our conversation?",
            },
          },
          {
            type: "schedule-follow-up",
            config: {
              delay: "3 days",
              message:
                "Hope you're doing well! I wanted to follow up on our chat.",
            },
          },
          {
            type: "schedule-follow-up",
            config: {
              delay: "1 week",
              message: "Last check-in! Is there anything I can help you with?",
            },
          },
        ],
        executionCount: 12,
      },
    ];

    res.json({
      status: "success",
      autoResponders: mockAutoResponders,
      followUpSequences: mockFollowUpSequences,
    });
  } catch (error) {
    console.error("Error fetching automations:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/automation", async (req, res) => {
  try {
    const { name, type, triggers, conditions, actions, isActive, priority } =
      req.body;

    if (!name || !type || !triggers || !actions) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields",
      });
    }

    // Here you would save to database
    const automationId = Date.now(); // Mock ID generation

    console.log(`Creating new automation: ${name} (${type})`);

    res.json({
      status: "success",
      message: "Automation created successfully",
      automationId,
    });
  } catch (error) {
    console.error("Error creating automation:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.patch("/api/automation/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    console.log(
      `Toggling automation ${id} to ${isActive ? "active" : "inactive"}`
    );

    res.json({
      status: "success",
      message: `Automation ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling automation:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.delete("/api/automation/:id", async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Deleting automation ${id}`);

    res.json({
      status: "success",
      message: "Automation deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting automation:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Account Safety & Management Routes
app.get("/api/account-safety/accounts", async (req, res) => {
  try {
    const accounts = AccountsService.getAccountsWithHealth();
    const rateLimits = RateLimitService.getAllRateLimits();

    // Combine account data with rate limit data
    const enrichedAccounts = accounts.map((account) => {
      const rateLimit = rateLimits.find(
        (rl) => rl.username === account.username
      );

      return {
        id: account.username, // Use username as ID for compatibility
        username: account.username,
        email: account.email,
        status:
          account.riskLevel === "high"
            ? "restricted"
            : account.riskLevel === "medium"
              ? "warning"
              : "healthy",
        dmsToday: rateLimit?.messages_sent_today || 0,
        dailyDmLimit: rateLimit?.daily_limit || 50,
        followsToday: 0, // Would need separate tracking
        dailyFollowLimit: 50,
        lastActive: account.updated_at,
        proxyId: account.proxy_id,
        rotationEnabled: true, // Would need to track this
        riskScore: account.healthScore
          ? Math.floor((100 - account.healthScore) / 10)
          : 1,
        warningsCount:
          account.riskLevel === "high"
            ? 3
            : account.riskLevel === "medium"
              ? 1
              : 0,
        isActive: account.isActive,
      };
    });

    res.json({
      status: "success",
      accounts: enrichedAccounts,
    });
  } catch (error) {
    console.error("Error fetching account safety data:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/api/account-safety/proxies", async (req, res) => {
  try {
    const proxies = ProxyService.getProxies();
    res.json({
      status: "success",
      proxies: proxies,
    });
  } catch (error) {
    console.error("Error fetching proxies:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/account-safety/proxies", async (req, res) => {
  try {
    const { host, port, username, password, type } = req.body;

    if (!host || !port || !type) {
      return res.status(400).json({
        status: "error",
        message: "Host, port, and type are required",
      });
    }

    const proxyData = {
      host,
      port: parseInt(port),
      username: username || null,
      password: password || null,
      type,
      isActive: 1, // Use 1 for true, 0 for false
    };

    const proxyId = ProxyService.createProxy(proxyData);

    console.log(`Added new proxy: ${host}:${port} (${type})`);

    res.json({
      status: "success",
      message: "Proxy added successfully",
      proxyId: proxyId,
    });
  } catch (error) {
    console.error("Error adding proxy:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Delete a proxy by ID
app.delete("/api/account-safety/proxies/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = ProxyService.deleteProxy(parseInt(id));
    if (success) {
      res.json({
        status: "success",
        message: "Proxy deleted successfully",
      });
    } else {
      res.status(404).json({
        status: "error",
        message: "Proxy not found",
      });
    }
  } catch (error) {
    console.error("Error deleting proxy:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/api/account-safety/rate-limits", async (req, res) => {
  try {
    const rateLimits = RateLimitService.getAllRateLimits();
    res.json({
      status: "success",
      rateLimits: rateLimits,
    });
  } catch (error) {
    console.error("Error fetching rate limits:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Create new rate limit
app.post("/api/account-safety/rate-limits", async (req, res) => {
  try {
    const { accountId, dmPerHour, dmPerDay, followPerHour, followPerDay, isActive } = req.body;
    
    // Get account by ID
    const accounts = AccountsService.getAccounts();
    const account = accounts.find(acc => acc.id == accountId);
    
    if (!account) {
      return res.status(404).json({ 
        status: "error", 
        message: "Account not found" 
      });
    }

    const rateLimitData = {
      username: account.username,
      dmPerHour,
      dmPerDay,
      followPerHour,
      followPerDay,
      isActive,
    };

    const rateLimitId = RateLimitService.createRateLimit(rateLimitData);
    
    res.json({
      status: "success",
      message: "Rate limit created successfully",
      rateLimitId: rateLimitId,
    });
  } catch (error) {
    console.error("Error creating rate limit:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Update rate limit
app.put("/api/account-safety/rate-limits/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const success = RateLimitService.updateRateLimit(id, updates);
    
    if (success) {
      res.json({
        status: "success",
        message: "Rate limit updated successfully",
      });
    } else {
      res.status(404).json({
        status: "error",
        message: "Rate limit not found",
      });
    }
  } catch (error) {
    console.error("Error updating rate limit:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Delete rate limit
app.delete("/api/account-safety/rate-limits/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const success = RateLimitService.deleteRateLimit(id);
    
    if (success) {
      res.json({
        status: "success",
        message: "Rate limit deleted successfully",
      });
    } else {
      res.status(404).json({
        status: "error",
        message: "Rate limit not found",
      });
    }
  } catch (error) {
    console.error("Error deleting rate limit:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.patch("/api/account-safety/accounts/:id/rotation", async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    console.log(`Setting account ${id} rotation to ${enabled}`);

    res.json({
      status: "success",
      message: `Account rotation ${enabled ? "enabled" : "disabled"}`,
    });
  } catch (error) {
    console.error("Error updating account rotation:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/api/account-safety/health-check/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;

    // Mock health check data
    const healthCheck = {
      accountId: parseInt(accountId),
      overallHealth: "good",
      riskFactors: [
        {
          factor: "Rate limits",
          status: "green",
          message: "Within safe limits",
        },
        {
          factor: "Activity pattern",
          status: "yellow",
          message: "Slightly elevated activity",
        },
        {
          factor: "Proxy connection",
          status: "green",
          message: "Proxy working well",
        },
        { factor: "Account age", status: "green", message: "Mature account" },
      ],
      recommendations: [
        "Consider reducing DM frequency during peak hours",
        "Add more variety to message templates",
        "Implement longer delays between actions",
      ],
      lastChecked: new Date().toISOString(),
    };

    res.json({
      status: "success",
      healthCheck,
    });
  } catch (error) {
    console.error("Error performing health check:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Initialize rate limit counters
  setInterval(
    () => {
      ratelimits.resetHourlyCounters();
    },
    60 * 60 * 1000
  ); // Every hour

  setInterval(
    () => {
      ratelimits.resetDailyCounters();
    },
    24 * 60 * 60 * 1000
  ); // Every day
});

// Advanced Targeting & Scraping Routes - Updated to use database services
app.get("/api/targeting/scraping-jobs", async (req, res) => {
  try {
    const jobs = ScrapingService.getAllJobs();
    res.json({
      status: "success",
      jobs: jobs,
    });
  } catch (error) {
    console.error("Error fetching scraping jobs:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/api/targeting/leads", async (req, res) => {
  try {
    const leads = LeadsService.getScrapedLeads();
    res.json({
      status: "success",
      leads: leads,
    });
  } catch (error) {
    console.error("Error fetching scraped leads:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/api/targeting/rules", async (req, res) => {
  try {
    const rules = LeadsService.getTargetingRules();
    res.json({
      status: "success",
      rules: rules,
    });
  } catch (error) {
    console.error("Error fetching targeting rules:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post("/api/targeting/scraping-jobs", async (req, res) => {
  try {
    const { name, type, targets, filters, maxLeads } = req.body;

    if (!name || !type || !targets || targets.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Name, type, and targets are required",
      });
    }

    const jobData = {
      name,
      type,
      targets: JSON.stringify(targets),
      filters: JSON.stringify(filters || {}),
      maxLeads: maxLeads || 1000,
      status: "pending",
    };

    const job = ScrapingService.createJob(jobData);

    console.log(`Created new scraping job: ${name} (${type})`);
    console.log(`Targets: ${targets.join(", ")}`);
    console.log(`Max leads: ${maxLeads}`);

    res.json({
      status: "success",
      message: "Scraping job created successfully",
      jobId: job.id,
    });
  } catch (error) {
    console.error("Error creating scraping job:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.patch("/api/targeting/scraping-jobs/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const job = ScrapingService.getJob(id);
    if (!job) {
      return res.status(404).json({
        status: "error",
        message: "Scraping job not found",
      });
    }

    ScrapingService.updateJob(id, {
      status: isActive ? "active" : "paused",
    });

    console.log(
      `Toggled scraping job ${id} to ${isActive ? "active" : "inactive"}`
    );

    res.json({
      status: "success",
      message: `Scraping job ${isActive ? "started" : "stopped"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling scraping job:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/api/targeting/leads/export", async (req, res) => {
  try {
    const { format = "csv" } = req.query;

    // Mock CSV data - in real implementation, you'd query your database
    const csvData = `Username,Full Name,Followers,Following,Posts,Engagement Rate,Location,Tags
fitness_guru_23,Sarah Johnson,12500,850,324,4.2,"Los Angeles, CA",fitness;lifestyle
tech_entrepreneur,Mike Chen,8900,1200,156,6.1,"San Francisco, CA",tech;startup
lifestyle_blogger,Emma Rodriguez,25600,450,892,3.8,"Miami, FL",lifestyle;travel`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
    res.send(csvData);
  } catch (error) {
    console.error("Error exporting leads:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Advanced scraping endpoint for competitor followers
app.post("/api/targeting/scrape-competitor-followers", async (req, res) => {
  try {
    const { competitorUsername, maxFollowers = 1000, filters = {} } = req.body;

    if (!competitorUsername) {
      return res.status(400).json({
        status: "error",
        message: "Competitor username is required",
      });
    }

    console.log(
      `Starting competitor follower scraping for @${competitorUsername}`
    );
    console.log(`Max followers to scrape: ${maxFollowers}`);
    console.log(`Filters:`, filters);

    // Here you would implement the actual scraping logic
    // For now, we'll return a success response
    res.json({
      status: "success",
      message: "Competitor follower scraping started",
      jobId: Date.now(),
      estimatedTime: "15-30 minutes",
    });
  } catch (error) {
    console.error("Error starting competitor scraping:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ================== REPORTING & EXPORT API ENDPOINTS ==================

// Get all reports
app.get("/api/reports", async (req, res) => {
  try {
    const reports = [
      {
        id: 1,
        name: "Weekly Performance Summary",
        type: "scheduled",
        lastGenerated: new Date().toISOString(),
        status: "active",
        format: "pdf",
        metrics: ["messages_sent", "responses_received", "leads_generated"],
      },
      {
        id: 2,
        name: "Campaign ROI Analysis",
        type: "custom",
        lastGenerated: new Date().toISOString(),
        status: "completed",
        format: "excel",
      },
    ];

    const customReports = [
      {
        id: 3,
        name: "Lead Quality Assessment",
        type: "automated",
        lastGenerated: new Date().toISOString(),
        status: "active",
        format: "csv",
      },
    ];

    res.json({ reports, customReports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get scheduled reports
app.get("/api/reports/scheduled", async (req, res) => {
  try {
    const scheduledReports = [
      {
        id: 1,
        name: "Daily Summary",
        frequency: "daily",
        time: "09:00",
        recipients: ["manager@company.com"],
        nextRun: new Date(Date.now() + 86400000).toISOString(),
        status: "active",
      },
      {
        id: 2,
        name: "Weekly Analytics",
        frequency: "weekly",
        time: "08:00",
        recipients: ["team@company.com"],
        nextRun: new Date(Date.now() + 604800000).toISOString(),
        status: "active",
      },
    ];

    res.json({ scheduledReports });
  } catch (error) {
    console.error("Error fetching scheduled reports:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new report
app.post("/api/reports/create", async (req, res) => {
  try {
    const { name, type, metrics, dateRange, format, schedule } = req.body;

    // Validate required fields
    if (!name || !metrics || metrics.length === 0) {
      return res.status(400).json({
        error: "Report name and at least one metric are required",
      });
    }

    const newReport = {
      id: Date.now(),
      name,
      type: type || "custom",
      metrics,
      dateRange: dateRange || "last_30_days",
      format: format || "pdf",
      schedule: schedule || { frequency: "manual" },
      createdAt: new Date().toISOString(),
      status: "active",
    };

    // In a real application, save to database
    console.log("Created new report:", newReport);

    res.json({
      message: "Report created successfully",
      report: newReport,
    });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ error: error.message });
  }
});

// Export report
app.post("/api/reports/:id/export", async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.body;

    // Simulate report generation
    await delay(2000);

    // In a real application, generate actual report file
    const reportData = {
      reportId: id,
      format: format || "pdf",
      generatedAt: new Date().toISOString(),
      data: {
        messagesSent: 1547,
        responsesReceived: 423,
        leadsGenerated: 89,
        conversionRate: 21.04,
      },
    };

    // Set appropriate headers for file download
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report-${id}.${format}"`
    );

    // Send mock file content
    res.send(JSON.stringify(reportData, null, 2));
  } catch (error) {
    console.error("Error exporting report:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get export jobs
app.get("/api/exports/jobs", async (req, res) => {
  try {
    const jobs = [
      {
        id: 1,
        name: "All Leads Export",
        type: "leads",
        status: "completed",
        progress: 100,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        completedAt: new Date(Date.now() - 7080000).toISOString(),
        recordCount: 1547,
        fileSize: "2.3 MB",
        downloadUrl: "/downloads/leads-export-123.csv",
      },
      {
        id: 2,
        name: "Campaign Data Export",
        type: "campaigns",
        status: "processing",
        progress: 67,
        createdAt: new Date(Date.now() - 900000).toISOString(),
        estimatedCompletion: new Date(Date.now() + 300000).toISOString(),
        recordCount: 890,
      },
    ];

    res.json({ jobs });
  } catch (error) {
    console.error("Error fetching export jobs:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start data export
app.post("/api/exports/start", async (req, res) => {
  try {
    const { type, filters, format } = req.body;

    if (!type) {
      return res.status(400).json({ error: "Export type is required" });
    }

    const exportJob = {
      id: Date.now(),
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Export`,
      type,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
      estimatedStart: new Date(Date.now() + 30000).toISOString(),
      filters: filters || {},
      format: format || "csv",
    };

    // In a real application, start background export process
    console.log("Started export job:", exportJob);

    res.json({
      message: "Export job started",
      job: exportJob,
    });
  } catch (error) {
    console.error("Error starting export:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================== TEAM COLLABORATION API ENDPOINTS ==================

// Get team members
app.get("/api/team/members", async (req, res) => {
  try {
    const members = [
      {
        id: 1,
        name: "John Smith",
        email: "john@company.com",
        role: "admin",
        status: "active",
        lastActive: new Date(Date.now() - 1800000).toISOString(),
        joinedAt: "2024-01-15",
        workspaces: ["main", "campaign-team"],
        avatar: null,
      },
      {
        id: 2,
        name: "Sarah Johnson",
        email: "sarah@company.com",
        role: "manager",
        status: "active",
        lastActive: new Date(Date.now() - 5400000).toISOString(),
        joinedAt: "2024-03-10",
        workspaces: ["main"],
        avatar: null,
      },
      {
        id: 3,
        name: "Mike Wilson",
        email: "mike@company.com",
        role: "member",
        status: "invited",
        lastActive: null,
        joinedAt: new Date().toISOString(),
        workspaces: ["campaign-team"],
        avatar: null,
      },
    ];

    res.json({ members });
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get roles and permissions
app.get("/api/team/roles", async (req, res) => {
  try {
    const roles = [
      {
        id: "admin",
        name: "Administrator",
        description: "Full access to all features and settings",
        permissions: [
          "view_dashboard",
          "send_messages",
          "manage_campaigns",
          "view_analytics",
          "export_data",
          "manage_leads",
          "manage_accounts",
          "team_admin",
          "billing_access",
          "api_access",
        ],
        color: "#EF4444",
        memberCount: 1,
      },
      {
        id: "manager",
        name: "Manager",
        description: "Can manage campaigns and view analytics",
        permissions: [
          "view_dashboard",
          "send_messages",
          "manage_campaigns",
          "view_analytics",
          "manage_leads",
        ],
        color: "#F59E0B",
        memberCount: 1,
      },
      {
        id: "member",
        name: "Team Member",
        description: "Basic access to messaging and lead management",
        permissions: ["view_dashboard", "send_messages", "manage_leads"],
        color: "#3B82F6",
        memberCount: 3,
      },
    ];

    res.json({ roles });
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get shared templates
app.get("/api/team/templates", async (req, res) => {
  try {
    const templates = [
      {
        id: 1,
        name: "Cold Outreach Template",
        type: "message",
        createdBy: "John Smith",
        createdAt: "2024-12-15",
        usage: 45,
        shared: true,
        workspaces: ["main", "campaign-team"],
        content: "Hey {name}, I noticed you're into {interest}...",
      },
      {
        id: 2,
        name: "Follow-up Sequence",
        type: "automation",
        createdBy: "Sarah Johnson",
        createdAt: "2024-12-18",
        usage: 23,
        shared: true,
        workspaces: ["main"],
        steps: 3,
      },
      {
        id: 3,
        name: "Lead Qualification Flow",
        type: "workflow",
        createdBy: "Mike Wilson",
        createdAt: "2024-12-19",
        usage: 12,
        shared: false,
        workspaces: ["campaign-team"],
      },
    ];

    res.json({ templates });
  } catch (error) {
    console.error("Error fetching shared templates:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get workspaces
app.get("/api/team/workspaces", async (req, res) => {
  try {
    const workspaces = [
      {
        id: "main",
        name: "Main Workspace",
        description: "Primary workspace for all team activities",
        memberCount: 3,
        createdAt: "2024-01-15",
        settings: {
          privacy: "team_only",
          defaultRole: "member",
        },
      },
      {
        id: "campaign-team",
        name: "Campaign Team",
        description: "Dedicated workspace for campaign management",
        memberCount: 2,
        createdAt: "2024-03-20",
        settings: {
          privacy: "private",
          defaultRole: "member",
        },
      },
    ];

    res.json({ workspaces });
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get team activity log
app.get("/api/team/activity", async (req, res) => {
  try {
    const activities = [
      {
        id: 1,
        user: "John Smith",
        action: "invited new member",
        target: "mike@company.com",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        type: "member",
        details: { role: "member", workspace: "campaign-team" },
      },
      {
        id: 2,
        user: "Sarah Johnson",
        action: "shared template",
        target: "Follow-up Sequence",
        timestamp: new Date(Date.now() - 5400000).toISOString(),
        type: "template",
        details: { templateId: 2, workspace: "main" },
      },
      {
        id: 3,
        user: "John Smith",
        action: "updated role permissions",
        target: "Manager role",
        timestamp: new Date(Date.now() - 97200000).toISOString(),
        type: "role",
        details: { roleId: "manager", addedPermissions: ["export_data"] },
      },
      {
        id: 4,
        user: "Mike Wilson",
        action: "joined workspace",
        target: "Campaign Team",
        timestamp: new Date(Date.now() - 176400000).toISOString(),
        type: "workspace",
        details: { workspaceId: "campaign-team" },
      },
    ];

    res.json({ activities });
  } catch (error) {
    console.error("Error fetching team activity:", error);
    res.status(500).json({ error: error.message });
  }
});

// Invite team member
app.post("/api/team/invite", async (req, res) => {
  try {
    const { email, role, workspaces, message } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        error: "Email and role are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const invitation = {
      id: Date.now(),
      email,
      role,
      workspaces: workspaces || [],
      message: message || "",
      invitedBy: "current_user", // In a real app, get from auth context
      invitedAt: new Date().toISOString(),
      status: "pending",
      expiresAt: new Date(Date.now() + 604800000).toISOString(), // 7 days
    };

    // In a real application, send invitation email
    console.log("Sent invitation:", invitation);

    res.json({
      message: "Invitation sent successfully",
      invitation,
    });
  } catch (error) {
    console.error("Error sending invitation:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update member role
app.put("/api/team/members/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }

    // In a real application, update in database
    console.log(`Updated member ${id} role to ${role}`);

    res.json({
      message: "Member role updated successfully",
      memberId: id,
      newRole: role,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating member role:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create custom role
app.post("/api/team/roles", async (req, res) => {
  try {
    const { name, description, permissions, color } = req.body;

    if (!name || !permissions || permissions.length === 0) {
      return res.status(400).json({
        error: "Role name and at least one permission are required",
      });
    }

    const newRole = {
      id: name.toLowerCase().replace(/\s+/g, "_"),
      name,
      description: description || "",
      permissions,
      color: color || "#3B82F6",
      memberCount: 0,
      createdAt: new Date().toISOString(),
      createdBy: "current_user", // In a real app, get from auth context
    };

    // In a real application, save to database
    console.log("Created new role:", newRole);

    res.json({
      message: "Role created successfully",
      role: newRole,
    });
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ error: error.message });
  }
});

// Share template
app.post("/api/team/templates/:id/share", async (req, res) => {
  try {
    const { id } = req.params;
    const { workspaces, users } = req.body;

    // In a real application, update template sharing settings
    console.log(
      `Shared template ${id} with workspaces:`,
      workspaces,
      "and users:",
      users
    );

    res.json({
      message: "Template shared successfully",
      templateId: id,
      sharedWith: { workspaces, users },
      sharedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error sharing template:", error);
    res.status(500).json({ error: error.message });
  }
});

// Instagram Service Management - TEMPORARILY DISABLED DUE TO MISSING DEPENDENCIES
// const InstagramService = require("./services/instagramService_fixed.js");

// Global Instagram service instance
let instagramService = null;

// Get Saved Instagram Accounts - USING BASIC ACCOUNTS STORE
app.get("/api/instagram/accounts", async (req, res) => {
  try {
    const accounts = accountsStore.loadAccounts();
    // Return only usernames, not sensitive data like cookies
    const accountList = accounts.map((account) => ({
      username: account.username,
      hasSession: account.cookies && account.cookies.length > 0,
    }));

    res.json({
      status: "success",
      accounts: accountList,
    });
  } catch (error) {
    console.error("Error getting saved accounts:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Instagram Login (with saved cookies or fresh login)
app.post("/api/instagram/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username) {
      return res.status(400).json({
        status: "error",
        message: "Username is required",
      });
    }

    // Instantiate InstagramService for this request, potentially passing username
    // if your service is designed to handle user-specific sessions this way.
    // If you maintain a single global instagramService instance, this part will differ.
    // For this example, we create a new service instance for the login attempt.
    // This assumes instagramService is designed to be instantiated per-operation or per-user.
    // Consider if a global instance needs to be managed differently.

    // If you have a global instagramService instance that needs to be (re)initialized for a user:
    if (instagramService && typeof instagramService.close === "function") {
      // await instagramService.close(); // Close previous session if any
    }
    // The refactored InstagramService constructor might take username for session path
    // instagramService = new InstagramService(username); // TEMPORARILY DISABLED

    // TEMPORARY SIMPLE LOGIN RESPONSE
    if (password) {
      return res.json({
        status: "success",
        message: "Login functionality temporarily simplified. Use /api/add-account for full Instagram login.",
        user: username,
      });
    } else {
      return res.status(401).json({
        status: "error",
        message: "Password required for login",
      });
    }

    /* ORIGINAL CODE TEMPORARILY DISABLED
    // The 'initialize' method is no longer separate.
    // Login process itself will handle browser initialization via PuppeteerHelper.
    // await instagramService.initialize(); // REMOVED

    let loginSuccess = false;

    // The refactored login method in InstagramService (via InstagramApi)
    // should handle trying to load session / cookies first, then full login.
    console.log(`Attempting login for: ${username}`);
    // The single login method now handles both scenarios (with or without password)
    loginSuccess = await instagramService.login(username, password);

    // // First try to login with saved cookies - REMOVED, handled by login()
    // console.log(`Attempting login with saved cookies for: ${username}`);
    // loginSuccess = await instagramService.loginWithSavedCookies(username);

    // // If saved cookies failed and password is provided, try fresh login - REMOVED, handled by login()    // if (!loginSuccess && password) {
    //   console.log(
    //     `Saved cookies failed, attempting fresh login for: ${username}`
    //   );
    //   loginSuccess = await instagramService.login(username, password);
    // }

    if (loginSuccess) {
      res.json({
        status: "success",
        message: "Logged in successfully",
        user: username,
      });
    } else {
      res.status(401).json({
        status: "error",
        message: "Login failed. Please check your credentials or try again.",
      });
    }
    */
  } catch (error) {
    console.error("Instagram login error in route:", error); // Added "in route" for clarity
    res.status(500).json({
      status: "error",
      // Send a more generic message to the client for security
      message: "An internal server error occurred during login.",
      // message: error.message, // Avoid sending detailed error messages to client
    });
  }
});

// Get Login Status - TEMPORARILY SIMPLIFIED
app.get("/api/instagram/status", async (req, res) => {
  try {
    // TEMPORARY: Return basic status since InstagramService is disabled
    res.json({
      status: "success",
      isLoggedIn: false,
      currentUser: null,
      message: "Instagram service temporarily simplified. Use /api/accounts to check saved accounts."
    });

    /* ORIGINAL CODE TEMPORARILY DISABLED
    const isLoggedIn =
      instagramService && instagramService.instagramApi.getIsLoggedIn();
    const currentUser = isLoggedIn
      ? instagramService.instagramApi.getCurrentUser()
      : null;

    res.json({
      status: "success",
      isLoggedIn,
      currentUser,
    });
    */
  } catch (error) {
    console.error("Error getting status:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});
