const logger = require("./logger");
const sanitizeHtml = require("sanitize-html");

// Middleware for handling 404 errors
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Middleware for sanitizing request bodies
const sanitize = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = sanitizeHtml(req.body[key], {
          allowedTags: [],
          allowedAttributes: {},
        });
      }
    }
  }
  next();
};

// Middleware for central error handling
const errorHandler = (err, req, res, next) => {
  // Determine response status code
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Log error details
  logger.error(
    `${statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip} - ${err.stack || "No stack trace"}`
  );

  // Send error response to client
  res.status(statusCode).json({
    status: "error",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

module.exports = {
  notFound,
  errorHandler,
  sanitize,
};
