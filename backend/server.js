require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

// Import custom utilities
const logger = require("./utils/logger");
const { notFound, errorHandler, sanitize } = require("./utils/middleware");
const { validate } = require("./utils/validator");
const db = require("./database/db");

// Import business logic modules
const { sendDMs } = require("./sendDMs");
const { initializeScheduler, RATE_LIMITS } = require("./scheduler");
const accountsStore = require("./accountsStore");
const targetsStore = require("./targetsStore");
const { scrapeProduct } = require("./puppeteerScraper");
const { scrapeFollowers } = require("./followerScraper");
const { scrapeHashtag } = require("./hashtagScraper");
const { scrapeKeyword } = require("./keywordScraper");

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
const PORT = process.env.PORT || 5000;
const VERSION = process.env.npm_package_version || "1.0.0";
app.use((req, res, next) => {
  console.log("→", req.method, req.path);
  console.log("   Incoming X-API-KEY header:", req.get("x-api-key"));
  console.log("   Loaded API_KEY env var:", process.env.API_KEYS_MUTATE);
  next();
});
// Custom delay function using Promise
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Setup HTTP request logging - only for file logging, reduce console noise
const accessLogStream = fs.createWriteStream(path.join(logDir, "access.log"), {
  flags: "a",
});

// Configure morgan for different environments
if (process.env.NODE_ENV === "production") {
  // In production: only log to file, no console logging
  app.use(morgan("combined", { stream: accessLogStream }));
} else {
  // In development: log to both file and console, but skip certain endpoints
  app.use(morgan("combined", { stream: accessLogStream }));
  app.use(
    morgan("dev", {
      skip: (req, res) => {
        // Skip logging for frequent polling endpoints in development
        const skipPaths = [
          "/api/exports/jobs",
          "/api/reports",
          "/api/reports/scheduled",
        ];
        return (
          skipPaths.some((path) => req.originalUrl.includes(path)) &&
          req.method === "GET"
        );
      },
    })
  );
}

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://instagram.com"],
      },
    },
    referrerPolicy: { policy: "same-origin" },
  })
);

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});

// Apply rate limiting to all API routes (skip high-frequency dm-progress polling)
app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/dm-progress/")) return next();
  return apiLimiter(req, res, next);
});

// Configure CORS properly for production
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL || "http://localhost:3000"
        : "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  })
);

// Body parser with size limits to prevent large payload attacks
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
// Apply sanitization middleware
app.use(sanitize);

// Initialize the scheduler when the server starts
initializeScheduler();

// Health check endpoint
app.get("/health", (req, res) => {
  try {
    // Check database connection
    const dbCheck = db.prepare("SELECT 1").get();

    res.json({
      status: "healthy",
      version: VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dbConnection: dbCheck ? "connected" : "error",
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.post(
  "/api/send-dms",
  authApiKey("mutate"),
  apiKeyRateLimit("mutate"),
  validate("sendDM"),
  async (req, res, next) => {
    try {
      const {
        username,
        usernames,
        message,
        scheduled,
        scheduleTime,
        messageVariations,
      } = req.body;

      // Accept either username or email for account lookup
      const account = AccountsService.getAccountByUsernameOrEmail(username);
      if (!account) {
        return res.status(404).json({
          status: "error",
          message: "Account not found for provided username or email.",
        });
      }
      const accountUsername = account.username;

      logger.info(
        `Processing DM request from ${accountUsername} to ${usernames.length} recipients`
      );

      // Enforce daily DM cap before proceeding (immediate sends only)
      if (!scheduled) {
        try {
          const stats = await getDMStats(accountUsername);
          const dailyCap = require("./config").dm.limits.dailyAccountCap;
          const already =
            stats.current_daily_count || stats.daily_dm_count || 0;
          const requested = usernames.length;
          if (already + requested > dailyCap) {
            global.metrics &&
              (global.metrics.dmDailyCapBlocks =
                (global.metrics.dmDailyCapBlocks || 0) + 1);
            return res.status(429).json({
              status: "error",
              message: `Daily DM cap exceeded: ${already} sent, ${requested} requested, cap ${dailyCap}. Remaining: ${Math.max(dailyCap - already, 0)}`,
            });
          }
        } catch (capErr) {
          logger.warn(
            `Daily cap pre-check failed for ${accountUsername}: ${capErr.message}`
          );
        }
      }

      // Handle scheduling
      if (scheduled && scheduleTime) {
        logger.info(`Scheduling DM for ${accountUsername} at ${scheduleTime}`);

        // Use messageVariations if provided, otherwise use the single message
        const variations =
          messageVariations && messageVariations.length > 0
            ? messageVariations
            : [message];

        try {
          const jobId = await scheduleDM({
            fromUsername: accountUsername,
            targetUsernames: usernames,
            messageVariations: variations,
            scheduleTime: scheduleTime,
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
          logger.error(
            `Failed to schedule DM for ${accountUsername}: ${scheduleError.message}`
          );
          return next(scheduleError);
        }
      } else {
        // Send immediately
        logger.info(
          `Sending immediate DM from ${accountUsername} to ${usernames.length} recipients`
        );

        await sendDMs({
          igUsername: accountUsername,
          usernames,
          message,
        });

        return res.json({
          status: "success",
          message: "Messages sent successfully",
        });
      }
    } catch (err) {
      logger.error(`DM sending error: ${err.message}`);
      next(err);
    }
  }
);

// Import account service for Puppeteer-based account management
const { addAccount } = require("./services/accountService");

app.post("/api/add-account", validate("login"), async (req, res, next) => {
  const { username, password } = req.body;
  try {
    // Use the extracted accountService
    const result = await addAccount(username, password);

    if (result.success) {
      res.json({
        status: "success",
        message: result.message,
      });
    } else {
      res.status(401).json({
        status: "error",
        message: result.message,
      });
    }
  } catch (err) {
    logger.error(`Error adding account ${username}: ${err.message}`);
    next(err);
  }
});

app.get("/api/accounts", async (req, res) => {
  try {
    let accounts = AccountsService.getAccounts();
    // Ensure every account has a valid email field
    accounts = accounts.map((acc) => ({
      ...acc,
      email: acc.email || acc.username, // Use username if email is null
    }));
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
        message: "Username and password are required",
      });
    }

    // Check if account exists in database
    const account = AccountsService.getAccountByUsername(username);
    if (!account) {
      return res.status(404).json({
        status: "error",
        message: "Account not found. Please add the account first.",
      });
    }

    console.log(`Starting Instagram login process for ${username}...`);

    // Import and run the login function
    const { loginAndSaveCookies } = require("./login");
    const result = await loginAndSaveCookies(username, password);

    if (result.success) {
      res.json({
        status: "success",
        message: "Successfully logged in and saved cookies to Instagram",
      });
    } else {
      res.status(500).json({
        status: "error",
        message: "Login failed - please check your credentials",
      });
    }
  } catch (error) {
    console.error("Error during Instagram login:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Login process failed",
    });
  }
});

app.put("/api/accounts/:username", async (req, res) => {
  try {
    const { username: originalUsername } = req.params;
    const updates = req.body;

    // Find the original account
    const account =
      AccountsService.getAccountByUsernameOrEmail(originalUsername);
    if (!account) {
      return res
        .status(404)
        .json({ status: "error", message: "Account not found" });
    }

    // Prepare updated account data, allowing username change
    const updatedAccountData = {
      ...account,
      username: updates.username || account.username,
      email: updates.email !== undefined ? updates.email : account.email,
      passwordHash:
        updates.password !== undefined
          ? updates.password
          : account.passwordHash,
      proxyId: updates.proxy ? parseInt(updates.proxy) : account.proxyId,
      isActive:
        updates.isActive !== undefined ? updates.isActive : account.isActive,
    };

    // Remove the old account if username is changing
    if (updatedAccountData.username !== account.username) {
      AccountsService.deleteAccount(account.username);
    }

    // Upsert the updated account
    const updatedAccount = AccountsService.upsertAccount(updatedAccountData);
    res.json({
      status: "success",
      message: "Account updated successfully",
      account: updatedAccount,
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
    const accountToDelete = accounts.find(
      (account) => account.id === accountId
    );

    if (!accountToDelete) {
      return res
        .status(404)
        .json({ status: "error", message: "Account not found" });
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
    console.log(
      `Scraping followers for: ${targetUsername} using account: ${igUsername}`
    );

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

    console.log(
      `Processed ${storedCount} leads from ${targetUsername}'s followers`
    );
    res.json({
      status: "success",
      leads,
      totalFound: followers.length,
      totalStored: storedCount,
      message: `Successfully scraped ${storedCount} followers from ${targetUsername} using account ${igUsername}`,
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
      return res
        .status(400)
        .json({ error: "Instagram username is required for authentication" });
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
        message: "Missing or invalid hashtag input",
      });
    }

    // Use default account if none specified, or get first available account
    let accountToUse = igUsername;
    if (!accountToUse) {
      const accounts = AccountsService.getAccounts();
      if (accounts.length === 0) {
        return res.status(400).json({
          status: "error",
          message:
            "No Instagram accounts available. Please add an account first.",
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
        message: "Invalid hashtag input",
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
      message: `Successfully scraped ${storedCount} usernames from hashtag #${hashtag}`,
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
        message: "Missing or invalid keywords input",
      });
    }

    // Use default account if none specified, or get first available account
    let accountToUse = igUsername;
    if (!accountToUse) {
      const accounts = AccountsService.getAccounts();
      if (accounts.length === 0) {
        return res.status(400).json({
          status: "error",
          message:
            "No Instagram accounts available. Please add an account first.",
        });
      }
      accountToUse = accounts[0].username;
      console.log("No account specified, using first available:", accountToUse);
    }

    console.log(
      `Searching for keywords: "${keywords}" using account: ${accountToUse}`
    );

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

    console.log(
      `Processed ${storedCount} leads from keyword search: "${keywords}"`
    );
    res.json({
      status: "success",
      leads,
      totalFound: usernames.length,
      totalStored: storedCount,
      message: `Successfully found ${storedCount} usernames for keywords: "${keywords}"`,
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
app.post(
  "/api/schedule-dms",
  authApiKey("mutate"),
  apiKeyRateLimit("mutate"),
  async (req, res) => {
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

      // Basic validation
      if (
        !fromUsername ||
        !Array.isArray(targetUsernames) ||
        !targetUsernames.length ||
        !Array.isArray(messageVariations) ||
        !messageVariations.length ||
        !scheduleTime
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "fromUsername, targetUsernames[], messageVariations[] and scheduleTime are required",
        });
      }

      const cleanFromUsername = fromUsername.replace(/^@/, "");

      // Daily cap pre-check (approximate, does not account for already scheduled counts yet)
      try {
        const stats = await getDMStats(cleanFromUsername);
        const dailyCap = require("./config").dm.limits.dailyAccountCap;
        const already = stats.current_daily_count || stats.daily_dm_count || 0;
        const requested = targetUsernames.length;
        if (already + requested > dailyCap) {
          if (global.metrics) {
            global.metrics.dmDailyCapBlocks =
              (global.metrics.dmDailyCapBlocks || 0) + 1;
          }
          return res.status(429).json({
            status: "error",
            message: `Daily DM cap exceeded for schedule: ${already} sent, ${requested} requested, cap ${dailyCap}. Remaining: ${Math.max(dailyCap - already, 0)}`,
          });
        }
      } catch (capErr) {
        logger.warn(
          `Schedule daily cap pre-check failed for ${fromUsername}: ${capErr.message}`
        );
      }

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
  }
);

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

// Re-added contact status update routes (PATCH & PUT)
console.log("Registering CRM contact status update routes");
function contactStatusValidation(status) {
  const validStatuses = ["lead", "prospect", "customer", "inactive"];
  return validStatuses.includes(status);
}
async function updateContactStatusHandler(req, res) {
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
    if (!contactStatusValidation(status)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid status value" });
    }
    const updated = await updateContactStatus(id, status);
    if (!updated) {
      return res
        .status(404)
        .json({ status: "error", message: "Contact not found" });
    }
    res.json({ status: "success", contact: updated });
  } catch (error) {
    console.error("Error updating contact status:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
}
app.patch("/api/crm/contacts/:id", updateContactStatusHandler);
app.put("/api/crm/contacts/:id", updateContactStatusHandler);

// Delete contact by numeric ID
app.delete("/api/crm/contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteContact } = require("./database/crm");
    const result = deleteContact(id);
    if (!result.deleted) {
      return res
        .status(404)
        .json({ status: "error", message: "Contact not found" });
    }
    res.json({
      status: "success",
      message: "Contact deleted",
      contact: result.contact,
    });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Delete contact by username
app.delete("/api/crm/contacts/username/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const { deleteContactByUsername } = require("./database/crm");
    const result = deleteContactByUsername(username);
    if (!result.deleted) {
      return res
        .status(404)
        .json({ status: "error", message: "Contact not found" });
    }
    res.json({
      status: "success",
      message: "Contact deleted",
      contact: result.contact,
    });
  } catch (error) {
    console.error("Error deleting contact by username:", error);
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
        dmsToday:
          rateLimit && rateLimit.messages_sent_today
            ? rateLimit.messages_sent_today
            : 0,
        dailyDmLimit:
          rateLimit && rateLimit.daily_limit ? rateLimit.daily_limit : 50,
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
    const {
      accountId,
      dmPerHour,
      dmPerDay,
      followPerHour,
      followPerDay,
      isActive,
    } = req.body;

    // Get account by ID
    const accounts = AccountsService.getAccounts();
    const account = accounts.find((acc) => acc.id == accountId);

    if (!account) {
      return res.status(404).json({
        status: "error",
        message: "Account not found",
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

// ================== REPORTING & EXPORT API ENDPOINTS ==================

const { ReportsService } = require("./database");

// List reports
app.get("/api/reports", (req, res) => {
  try {
    const reports = ReportsService.listReports();
    const enriched = reports.map((r) => ({
      ...r,
      latest: ReportsService.latestResult(r.id),
    }));
    res.json({ reports: enriched });
  } catch (e) {
    console.error("Error listing reports", e);
    res.status(500).json({ error: e.message });
  }
});

// Scheduled reports
app.get("/api/reports/scheduled", (req, res) => {
  try {
    const scheduledReports = ReportsService.listReports().filter(
      (r) => r.schedule_frequency !== "manual"
    );
    res.json({ scheduledReports });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create report
app.post("/api/reports/create", (req, res) => {
  try {
    const report = ReportsService.createReport(req.body);
    res.json({ report });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Get report detail
app.get("/api/reports/:id", (req, res) => {
  const report = ReportsService.getReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Not found" });
  res.json({ report, latest: ReportsService.latestResult(report.id) });
});

// Update report
app.patch("/api/reports/:id", (req, res) => {
  const updated = ReportsService.updateReport(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json({ report: updated });
});

// Delete report
app.delete("/api/reports/:id", (req, res) => {
  const existing = ReportsService.getReport(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  ReportsService.deleteReport(req.params.id);
  res.json({ deleted: true });
});

// Run report now
app.post("/api/reports/:id/run", (req, res) => {
  const report = ReportsService.getReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Not found" });
  const data = ReportsService.computeMetrics(report);
  const saved = ReportsService.saveReportResult(report.id, data);
  res.json({ result: saved });
});

// Export report (CSV or JSON)
app.post("/api/reports/:id/export", (req, res) => {
  const report = ReportsService.getReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Not found" });
  let latest = ReportsService.latestResult(report.id);
  if (!latest) {
    const data = ReportsService.computeMetrics(report);
    latest = ReportsService.saveReportResult(report.id, data);
  }
  const format = (req.body.format || report.format || "csv").toLowerCase();
  const filename = `report-${report.id}-${Date.now()}.${format === "excel" ? "csv" : format}`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}`);
  if (format === "json") {
    res.setHeader("Content-Type", "application/json");
    return res.send(JSON.stringify(latest, null, 2));
  }
  // CSV
  const metrics = latest.data.metrics || {};
  const csv =
    "metric,value\n" +
    Object.entries(metrics)
      .map(([k, v]) => `${k},${v}`)
      .join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.send(csv);
});

// Export jobs
app.get("/api/exports/jobs", (req, res) => {
  try {
    const jobs = ReportsService.listExportJobs();
    res.json({ jobs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/exports/start", (req, res) => {
  try {
    const job = ReportsService.createExportJob(req.body);
    setTimeout(() => processExport(job.id), 200);
    res.json({ job });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/exports/jobs/:id/download", (req, res) => {
  const job = ReportsService.getExportJob(req.params.id);
  if (!job || job.status !== "completed" || !job.file_path) {
    return res.status(404).json({ error: "Not ready" });
  }
  res.download(job.file_path, (err) => {
    if (err) console.error("Download error", err);
  });
});

function processExport(id) {
  const job = ReportsService.getExportJob(id);
  if (!job || job.status !== "queued") return;
  ReportsService.markExportStarted(id);
  let progress = 0;
  const interval = setInterval(() => {
    progress += 25;
    if (progress >= 100) {
      const filePath = path.join(__dirname, "exports", `export-${id}.csv`);
      try {
        const dummy =
          "id,value\n" +
          Array.from({ length: 10 })
            .map((_, i) => `${i + 1},data${i + 1}`)
            .join("\n");
        fs.writeFileSync(filePath, dummy);
      } catch (e) {
        ReportsService.failExport(id, e.message);
        clearInterval(interval);
        return;
      }
      ReportsService.completeExport(id, filePath, 10);
      clearInterval(interval);
    } else {
      ReportsService.updateExportProgress(id, progress);
    }
  }, 400);
}

// Simple scheduler for due reports
setInterval(() => {
  try {
    const due = ReportsService.listScheduledDue();
    due.forEach((r) => {
      const data = ReportsService.computeMetrics(r);
      ReportsService.saveReportResult(r.id, data);
    });
  } catch (e) {
    console.error("Scheduled report run error", e);
  }
}, 60_000);

// === DM PROGRESS STREAM ENDPOINTS (must be before notFound) ===
// In-memory session store
const dmProgressSessions = new Map();
// Strict post limiter for DM progress endpoints
const strictPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/send-dms-progress", strictPostLimiter);
app.use("/api/schedule-dms", strictPostLimiter);

app.post(
  "/api/send-dms-progress",
  authApiKey("mutate"),
  apiKeyRateLimit("mutate"),
  validate("sendDM"),
  async (req, res) => {
    // Daily cap pre-check for progress-based sending
    try {
      const { email, usernames } = req.body;
      const { AccountsService } = require("./database");
      const account = AccountsService.getAccountByEmail(email);
      if (!account) {
        return res.status(404).json({
          status: "error",
          message: "Account not found for provided email.",
        });
      }
      const stats = await getDMStats(account.email);
      const dailyCap = require("./config").dm.limits.dailyAccountCap;
      const already = stats.current_daily_count || stats.daily_dm_count || 0;
      const requested = Array.isArray(usernames) ? usernames.length : 0;
      if (already + requested > dailyCap) {
        if (global.metrics) {
          global.metrics.dmDailyCapBlocks =
            (global.metrics.dmDailyCapBlocks || 0) + 1;
        }
        return res.status(429).json({
          status: "error",
          message: `Daily DM cap exceeded: ${already} sent, ${requested} requested, cap ${dailyCap}. Remaining: ${Math.max(dailyCap - already, 0)}`,
        });
      }
    } catch (e) {
      logger.warn(`Progress send daily cap check failed: ${e.message}`);
    }
    try {
      // Only accept email for account lookup
      const {
        email,
        usernames,
        message,
        messageVariations,
        scheduled,
        scheduleTime,
      } = req.body;
      const { AccountsService } = require("./database");
      const account = AccountsService.getAccountByEmail(email);
      if (!account) {
        return res.status(404).json({
          status: "error",
          message: "Account not found for provided email.",
        });
      }
      const accountEmail = account.email;
      const sessionId = createProgressSession();
      if (!acquireAccountLock(accountEmail)) {
        pushProgress(sessionId, {
          stage: "error",
          message: "Another send in progress for this account",
          percent: 100,
          time: new Date().toISOString(),
        });
        return res.status(400).json({
          status: "error",
          message: "Another send in progress for this account",
        });
      }
      if (global.metrics)
        global.metrics.dmStarts = (global.metrics.dmStarts || 0) + 1;
      // Try to start DM sending, catch validation/account errors early
      try {
        await sendDMs({
          igEmail: accountEmail,
          usernames,
          message,
          messageVariations,
          scheduled,
          scheduleTime,
          onProgress: (evt) => pushProgress(sessionId, evt),
        });
        if (global.metrics)
          global.metrics.dmSuccess = (global.metrics.dmSuccess || 0) + 1;
        res.json({ status: "started", sessionId });
      } catch (err) {
        if (global.metrics)
          global.metrics.dmErrors = (global.metrics.dmErrors || 0) + 1;
        pushProgress(sessionId, {
          stage: "error",
          message: err.message,
          percent: 100,
          time: new Date().toISOString(),
        });
        releaseAccountLock(accountEmail);
        return res.status(400).json({ status: "error", message: err.message });
      }
      releaseAccountLock(accountEmail);
    } catch (err) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  }
);
// === END DM PROGRESS STREAM ENDPOINTS ===

// Clean up old progress sessions on server start
dmProgressSessions.clear();

// Apply error handling middleware - must be after all routes
app.use(notFound);
app.use(errorHandler);

// Clean shutdown handling
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

async function gracefulShutdown() {
  logger.info("Received shutdown signal, closing connections gracefully...");

  // Stop all message monitoring
  try {
    if (messageMonitor) {
      await messageMonitor.stopAllMonitoring();
      logger.info("All message monitors stopped");
    }
  } catch (err) {
    logger.error("Error stopping message monitors:", err);
  }

  // Close database connection
  try {
    const db = require("./database/db");
    db.close();
    logger.info("Database connection closed");
  } catch (err) {
    logger.error("Error closing database connection:", err);
  }

  logger.info("Shutdown complete, exiting process");
}

// Start the server
app.listen(PORT, () => {
  logger.info(
    `Server running in ${process.env.NODE_ENV || "development"} mode`
  );
  logger.info(`Server listening on http://localhost:${PORT}`);

  // Initialize rate limit counters
  setInterval(
    () => {
      try {
        ratelimits.resetHourlyCounters();
        logger.debug("Hourly rate limit counters reset");
      } catch (err) {
        logger.error("Error resetting hourly counters:", err);
      }
    },
    60 * 60 * 1000
  ); // Every hour

  setInterval(
    () => {
      try {
        ratelimits.resetDailyCounters();
        logger.debug("Daily rate limit counters reset");
      } catch (err) {
        logger.error("Error resetting daily counters:", err);
      }
    },
    24 * 60 * 60 * 1000
  ); // Every day
});

// Update metrics object to include keyRateLimited and new counters
let metrics = {
  requests: 0,
  dmStarts: 0,
  dmErrors: 0,
  keyRateLimited: 0,
  dmDailyCapBlocks: 0,
  dmSuccess: 0,
};
app.use((req, res, next) => {
  metrics.requests++;
  next();
});
app.get(
  "/api/health",
  authApiKey("read"),
  apiKeyRateLimit("read"),
  (req, res) => {
    res.json({ status: "ok", time: Date.now() });
  }
);
app.get(
  "/api/metrics",
  authApiKey("read"),
  apiKeyRateLimit("read"),
  (req, res) => {
    res.type("text/plain").send(
      Object.entries(metrics)
        .map(([k, v]) => `${k} ${v}`)
        .join("\n")
    );
  }
);

global.metrics = metrics;

const config = require("./config");

// API Key auth middleware
function authApiKey(requiredScope) {
  return (req, res, next) => {
    const key = req.headers["x-api-key"];
    if (!key) return res.status(401).json({ error: "API key required" });
    const { apiKeys } = config;
    const isRead = apiKeys.read.has(key);
    const isMutate = apiKeys.mutate.has(key);
    req.apiKeyScope = isMutate ? "mutate" : isRead ? "read" : undefined;
    if (requiredScope === "read" && (isRead || isMutate)) return next();
    if (requiredScope === "mutate" && isMutate) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

// Per-API-key rate limiter
const KEY_LIMITS = {
  read: { windowMs: 15 * 60 * 1000, max: 500 },
  mutate: { windowMs: 15 * 60 * 1000, max: 120 },
};
const keyRateState = { read: new Map(), mutate: new Map() }; // scope -> Map(key -> {count, reset})
function apiKeyRateLimit(scope) {
  return (req, res, next) => {
    const key = req.headers["x-api-key"];
    if (!key) return res.status(401).json({ error: "API key required" });
    const limits = KEY_LIMITS[scope];
    const now = Date.now();
    let entry = keyRateState[scope].get(key);
    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + limits.windowMs };
      keyRateState[scope].set(key, entry);
    }
    if (entry.count >= limits.max) {
      metrics.keyRateLimited++;
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      return res
        .status(429)
        .json({ error: "API key rate limit exceeded", scope, retryAfter });
    }
    entry.count++;
    res.setHeader("X-RateLimit-Limit", limits.max);
    res.setHeader(
      "X-RateLimit-Remaining",
      Math.max(limits.max - entry.count, 0)
    );
    res.setHeader("X-RateLimit-Reset", Math.floor(entry.reset / 1000));
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  ["read", "mutate"].forEach((scope) => {
    for (const [k, v] of keyRateState[scope].entries()) {
      if (now > v.reset) keyRateState[scope].delete(k);
    }
  });
}, 60 * 1000);

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
lifestyle_blogger,Emma Rodriguez,25600,450,892,3.8,"Miami, FL",lifestyle`;

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

// Clean shutdown handling
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

async function gracefulShutdown() {
  logger.info("Received shutdown signal, closing connections gracefully...");

  // Stop all message monitoring
  try {
    if (messageMonitor) {
      await messageMonitor.stopAllMonitoring();
      logger.info("All message monitors stopped");
    }
  } catch (err) {
    logger.error("Error stopping message monitors:", err);
  }

  // Close database connection
  try {
    const db = require("./database/db");
    db.close();
    logger.info("Database connection closed");
  } catch (err) {
    logger.error("Error closing database connection:", err);
  }

  logger.info("Shutdown complete, exiting process");
}
