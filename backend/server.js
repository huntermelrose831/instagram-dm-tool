require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Import custom utilities
const logger = require("./utils/logger");
const { notFound, errorHandler, sanitize } = require("./utils/middleware");
const { validate } = require("./utils/validator");
const db = require("./database/db");

// Import business logic modules
const { sendDMs } = require("./sendDMs");
const { initializeScheduler, RATE_LIMITS } = require("./scheduler");
const TargetsService = require("./database/targets");
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
  ReportsService,
} = require("./database");

// Import ratelimits for counter resets
const ratelimits = require("./database/ratelimits.js");
// Import message monitoring system
const { messageMonitor } = require("./messageMonitor");
// Mount team collaboration routes

const app = express();

// Block access to sensitive files and paths
// Rate-limit unknown API calls to slow down brute-force scanners
const unknownLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10, // max 10 reqs per window per IP
  message: { error: "Too many invalid requests" },
});

// Set secure HTTP headers (additional to helmet)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});
const PORT = process.env.PORT || 5001; // Use 5001 to match Electron config
const VERSION = process.env.npm_package_version || "1.0.0";

// Custom delay function using Promise
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Create logs directory if it doesn't exist
const logDir = path.join(os.tmpdir(), "instagram-dm-tool", "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
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
/*app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/dm-progress/")) return next();
  return apiLimiter(req, res, next);
});*/

// Robust API key validation for all API routes
// Only require API key for non-GET requests
app.use("/api", (req, res, next) => {
  // Allow OPTIONS requests to pass through for CORS preflight
  if (req.method === "OPTIONS") {
    return next();
  }
  const apiKey = req.headers["x-api-key"];
  if (req.method === "GET") {
    // If you want GET requests to require a key, uncomment below
    // const validKeys = (process.env.API_KEYS_READ || "").split(",").map(k => k.trim());
    // if (!apiKey || !validKeys.includes(apiKey)) {
    //   return res.status(401).send("Unauthorized");
    // }
    return next();
  }
  // For mutation requests
  const validKeys = (process.env.API_KEYS_MUTATE || "")
    .split(",")
    .map((k) => k.trim());
  if (!apiKey || !validKeys.includes(apiKey)) {
    return res.status(401).send("Unauthorized");
  }
  next();
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
app.set("trust proxy", 1);
// team routes
const teamRoutes = require("./routes/team");
app.use("/api/team", teamRoutes);

// Progress tracking storage for DM sending sessions
const progressSessions = new Map();

// Generate unique session ID
const generateSessionId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

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

app.post("/api/send-dms", validate("sendDM"), async (req, res, next) => {
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
    const account = await AccountsService.getAccountByUsernameOrEmail(username);
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
        const already = stats.current_daily_count || stats.daily_dm_count || 0;
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
});

// Send DMs with progress tracking
app.post(
  "/api/send-dms-progress",
  validate("sendDM"),
  async (req, res, next) => {
    try {
      const { username, usernames, message, messageVariations } = req.body;

      // Accept either username or email for account lookup
      const account =
        await AccountsService.getAccountByUsernameOrEmail(username);
      if (!account) {
        return res.status(404).json({
          status: "error",
          message: "Account not found for provided username or email.",
        });
      }
      const accountUsername = account.username;

      logger.info(
        `Processing DM request with progress tracking from ${accountUsername} to ${usernames.length} recipients`
      );

      // Enforce daily DM cap before proceeding
      try {
        const stats = await getDMStats(accountUsername);
        const dailyCap = require("./config").dm.limits.dailyAccountCap;
        const already = stats.current_daily_count || stats.daily_dm_count || 0;
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

      // Generate session ID for progress tracking
      const sessionId = generateSessionId();

      // Initialize progress session
      progressSessions.set(sessionId, {
        events: [],
        done: false,
        startTime: new Date().toISOString(),
      });

      // Start DM sending asynchronously with progress tracking
      setImmediate(async () => {
        const session = progressSessions.get(sessionId);
        if (!session) return;

        try {
          // Use messageVariations if provided, otherwise use the single message
          const variations =
            messageVariations && messageVariations.length > 0
              ? messageVariations
              : [message];

          await sendDMs({
            igUsername: accountUsername,
            igEmail: account.email || accountUsername, // Provide email fallback
            usernames,
            message,
            messageVariations: variations,
            onProgress: (progressData) => {
              const session = progressSessions.get(sessionId);
              if (session) {
                session.events.push(progressData);
                // Clean up old events (keep last 100)
                if (session.events.length > 100) {
                  session.events = session.events.slice(-100);
                }
              }
            },
          });

          // Mark as complete
          const session = progressSessions.get(sessionId);
          if (session) {
            session.done = true;
            session.events.push({
              stage: "finish",
              message: "DM sending completed successfully",
              percent: 100,
              time: new Date().toISOString(),
            });
          }
        } catch (error) {
          // Mark as error
          const session = progressSessions.get(sessionId);
          if (session) {
            session.done = true;
            session.events.push({
              stage: "error",
              message: `DM sending failed: ${error.message}`,
              percent: 100,
              time: new Date().toISOString(),
            });
          }
          logger.error(
            `DM sending with progress tracking failed: ${error.message}`
          );
        }

        // Clean up session after 30 minutes
        setTimeout(
          () => {
            progressSessions.delete(sessionId);
          },
          30 * 60 * 1000
        );
      });

      return res.json({
        status: "success",
        message: "DM sending started with progress tracking",
        sessionId,
      });
    } catch (err) {
      logger.error(`DM progress sending error: ${err.message}`);
      next(err);
    }
  }
);

// Get DM progress for a session
app.get("/api/dm-progress/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = progressSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Progress session not found",
      });
    }

    return res.json({
      status: "success",
      events: session.events,
      done: session.done,
      startTime: session.startTime,
    });
  } catch (err) {
    logger.error(`DM progress retrieval error: ${err.message}`);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve progress",
    });
  }
});

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
    let accounts = (await AccountsService.getAccounts()) || [];
    // Ensure every account has a valid email field and parse cookies
    accounts = accounts.map((acc) => {
      let parsedCookies = null;
      if (acc.cookies) {
        try {
          parsedCookies =
            typeof acc.cookies === "string"
              ? JSON.parse(acc.cookies)
              : acc.cookies;
        } catch (parseError) {
          console.error(
            "Error parsing cookies for account:",
            acc.username,
            parseError
          );
          parsedCookies = null;
        }
      }
      return {
        ...acc,
        email: acc.email || acc.username, // Use username if email is null
        cookies: parsedCookies,
      };
    });
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

    const account = await AccountsService.addAccount(accountData);
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
    const account = await AccountsService.getAccountByUsername(username);
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
    const accounts = await AccountsService.getAccounts();
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
      res.json({ status: "success", message: "Account deleted successfully" });
    } else {
      res.status(404).json({ status: "error", message: "Account not found" });
    }
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Scheduled Jobs endpoints
app.get("/api/scheduled-jobs", async (req, res) => {
  try {
    const jobs = await getScheduledJobs();
    res.json({ status: "success", jobs });
  } catch (error) {
    console.error("Error fetching scheduled jobs:", error);
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
    for (const lead of leads) {
      try {
        await LeadsService.createLead({
          username: lead.username,
          profileUrl: lead.profileUrl,
          source: "instagram_followers",
          sourceUrl: postUrl,
          scrapedAt: lead.timestamp,
        });
        storedCount++;
      } catch (error) {
        // Handle duplicate username constraint
        if (error.code === "SQLITE_CONSTRAINT") {
          console.log(`Lead ${lead.username} already exists, skipping`);
        } else {
          console.error(`Error storing lead ${lead.username}:`, error);
        }
      }
    }

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

    // Convert to leads format for frontend (don't store in database yet)
    const leads = usernames.map((username) => ({
      username,
      profileUrl: `https://instagram.com/${username}`,
      source: "instagram_post_comments",
      sourceUrl: postUrl,
      scrapedAt: new Date().toISOString(),
      notes: "",
    }));

    // Return leads to frontend for temporary storage
    res.json({
      status: "success",
      leads,
      totalFound: usernames.length,
      message: `Successfully scraped ${usernames.length} usernames from post comments`,
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
    for (const lead of leads) {
      try {
        const result = await LeadsService.createLeadOrIgnore({
          username: lead.username,
          profileUrl: lead.profileUrl,
          source: "instagram_hashtag",
          sourceUrl: `#${hashtag}`,
          scrapedAt: lead.timestamp,
        });

        if (result.inserted) {
          storedCount++;
        } else {
          console.log(`Lead ${lead.username} already exists, skipping`);
        }
      } catch (error) {
        console.error(`Error storing lead ${lead.username}:`, error);
      }
    }

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
    for (const lead of leads) {
      try {
        await LeadsService.createLead({
          username: lead.username,
          profileUrl: lead.profileUrl,
          source: "instagram_keyword_search",
          sourceUrl: keywords,
          scrapedAt: lead.timestamp,
          notes: `Found via keyword search: ${keywords}`,
        });
        storedCount++;
      } catch (error) {
        // Handle duplicate username constraint
        if (error.code === "SQLITE_CONSTRAINT") {
          console.log(`Lead ${lead.username} already exists, skipping`);
        } else {
          console.error(`Error storing lead ${lead.username}:`, error);
        }
      }
    }

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
      message: error.message,
    });
  }
});

// Batch leads endpoints
app.post("/api/leads/batch", async (req, res) => {
  try {
    const { leads } = req.body;

    if (!leads || !Array.isArray(leads)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid leads data. Expected an array of leads.",
      });
    }

    let savedCount = 0;
    const errors = [];

    // Process each lead
    for (const lead of leads) {
      try {
        const {
          username,
          source = "manual",
          status = "new",
          isTarget = true,
        } = lead;

        if (!username) {
          errors.push("Username is required for each lead");
          continue;
        }

        // Add to leads table (or update if exists)
        const result = await LeadsService.createLeadOrIgnore({
          username: username.replace("@", ""),
          source,
          status,
          is_target: isTarget ? 1 : 0,
        });

        if (result.inserted) {
          savedCount++;
        } else {
          console.log(`Lead ${username} already exists, updating status`);
          const existingLead = await LeadsService.getLeadByUsername(
            username.replace("@", "")
          );
          if (existingLead) {
            await LeadsService.updateLead(existingLead.id, {
              is_target: isTarget ? 1 : 0,
              status: status || existingLead.status,
            });
          }
        }

        // If it's a target, also add to targets table
        if (isTarget) {
          await TargetsService.addTarget(username.replace("@", ""));
        }
      } catch (leadError) {
        console.error(`Error processing lead ${lead.username}:`, leadError);
        errors.push(`Failed to save ${lead.username}: ${leadError.message}`);
      }
    }

    res.json({
      status: "success",
      savedCount,
      totalRequested: leads.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully saved ${savedCount} out of ${leads.length} leads`,
    });
  } catch (error) {
    console.error("Error in batch leads endpoint:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to process batch leads",
    });
  }
});

// Target usernames endpoints - Use SQLite targets service
app.get("/api/targets", async (req, res) => {
  try {
    const targets = await TargetsService.loadTargets();
    res.json({ status: "success", targets });
  } catch (err) {
    console.error("Error fetching targets:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});

module.exports = app;
