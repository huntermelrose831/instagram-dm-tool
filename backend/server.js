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
  addNote,
  createTag,
  addTagToContact,
  removeTagFromContact,
  deleteContact,
  deleteContactByUsername,
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
    }),
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
  }),
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

// Configure CORS properly for production (must be before auth middleware)
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL || "http://localhost:3000"
        : "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// No API key auth required — this is a local Electron app on localhost

// Body parser with size limits to prevent large payload attacks
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
// Apply sanitization middleware
app.use(sanitize);
app.set("trust proxy", 1);
// team routes
const teamRoutes = require("./routes/team");
app.use("/api/team", teamRoutes);

// Feature routes
const accountsRouter = require("./routes/accounts");
const scrapeRouter = require("./routes/scrape");
const targetsRouter = require("./routes/targets");
const crmRouter = require("./routes/crm");
const reportsRouter = require("./routes/reports");
app.use("/api/accounts", accountsRouter);
app.use("/api/scrape", scrapeRouter);
app.use("/api", targetsRouter);
app.use("/api/crm", crmRouter);
app.use("/api", reportsRouter);

// Progress tracking storage for DM sending sessions
const progressSessions = new Map();

// Generate unique session ID
const generateSessionId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// Health check endpoint
app.get("/health", (req, res) => {
  const { db: rawDb } = require("./database/db");
  const checkDb = rawDb
    ? new Promise((resolve) =>
        rawDb.get("SELECT 1 as ok", [], (err) => resolve(!err)),
      )
    : Promise.resolve(false);

  checkDb
    .then((dbOk) => {
      res.json({
        status: "healthy",
        version: VERSION,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        dbConnection: dbOk ? "connected" : "unavailable",
        environment: process.env.NODE_ENV || "development",
      });
    })
    .catch((error) => {
      logger.error(`Health check failed: ${error.message}`);
      res.status(500).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    });
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
      `Processing DM request from ${accountUsername} to ${usernames.length} recipients`,
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
          `Daily cap pre-check failed for ${accountUsername}: ${capErr.message}`,
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
          `Failed to schedule DM for ${accountUsername}: ${scheduleError.message}`,
        );
        return next(scheduleError);
      }
    } else {
      // Send immediately
      logger.info(
        `Sending immediate DM from ${accountUsername} to ${usernames.length} recipients`,
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
        `Processing DM request with progress tracking from ${accountUsername} to ${usernames.length} recipients`,
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
          `Daily cap pre-check failed for ${accountUsername}: ${capErr.message}`,
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
            `DM sending with progress tracking failed: ${error.message}`,
          );
        }

        // Clean up session after 30 minutes
        setTimeout(
          () => {
            progressSessions.delete(sessionId);
          },
          30 * 60 * 1000,
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
  },
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

// Accounts CRUD → routes/accounts.js

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

// Scrape routes → routes/scrape.js

// Leads + Targets routes → routes/targets.js

// CRM routes → routes/crm.js

// Reports + Exports → routes/reports.js

// Leads + Targets routes → routes/targets.js

// CRM routes → routes/crm.js

// Reports + Exports → routes/reports.js

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
