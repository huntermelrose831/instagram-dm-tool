const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Ensure logs directory exists
const logDir = path.join(__dirname, "../logs");
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

// Define logger format
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define logger transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), format),
  }),
  // File transport for errors
  new winston.transports.File({
    filename: path.join(__dirname, "../logs/error.log"),
    level: "error",
    format,
  }),
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(__dirname, "../logs/combined.log"),
    format,
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  levels: logLevels,
  format,
  transports,
  exitOnError: false,
});

module.exports = logger;
