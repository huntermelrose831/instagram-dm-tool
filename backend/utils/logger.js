const winston = require("winston");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Ensure logs directory exists
const logDir = path.join(os.tmpdir(), "instagram-dm-tool", "logs");
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (err) {
  console.error(`Error creating logs directory: ${err.message}`);
}

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Get log level from environment (default to 'info' for production, 'debug' for development)
const getLogLevel = () => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  return process.env.NODE_ENV === "development" ? "debug" : "warn";
};

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf((info) => {
    // Filter out noisy HTTP logs in production
    if (info.level.includes("http") && getLogLevel() === "warn") {
      return null;
    }
    return `${info.timestamp} ${info.level}: ${info.message}`;
  })
);

// File format for structured logging
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define logger transports
const transports = [
  // Console transport - minimal in production
  new winston.transports.Console({
    level: getLogLevel(),
    format: consoleFormat,
    silent: process.env.NODE_ENV === "test",
  }),
  // File transport for errors only
  new winston.transports.File({
    filename: path.join(logDir, "error.log"),
    level: "error",
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // File transport for important logs only (info and above)
  new winston.transports.File({
    filename: path.join(logDir, "combined.log"),
    level: "info",
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: getLogLevel(),
  levels: logLevels,
  transports,
  exitOnError: false,
});

// Override console methods in production to reduce noise
if (process.env.NODE_ENV === "production") {
  const originalConsole = { ...console };
  console.log = (...args) => logger.debug(args.join(" "));
  console.info = (...args) => logger.info(args.join(" "));
  console.warn = (...args) => logger.warn(args.join(" "));
  console.error = (...args) => logger.error(args.join(" "));

  // Keep original console for critical startup messages
  logger.originalConsole = originalConsole;
}

// Add helper methods for structured logging
logger.logAPI = (method, path, statusCode, responseTime, userId = null) => {
  if (getLogLevel() === "debug") {
    logger.http(
      `${method} ${path} ${statusCode} ${responseTime}ms ${userId ? `[User: ${userId}]` : ""}`
    );
  }
};

logger.logScheduler = (message, data = null) => {
  if (data) {
    logger.info(`[SCHEDULER] ${message}: ${JSON.stringify(data)}`);
  } else {
    logger.info(`[SCHEDULER] ${message}`);
  }
};

logger.logDM = (message, metadata = {}) => {
  logger.info(`[DM] ${message}`, metadata);
};

module.exports = logger;
