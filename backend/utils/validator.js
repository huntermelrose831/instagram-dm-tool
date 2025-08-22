const Joi = require("joi");

// Validation schemas for various endpoints
const schemas = {
  // Authentication schemas
  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
  }),

  // Account schemas
  createAccount: Joi.object({
    username: Joi.string().required(),
    email: Joi.string().email().allow("", null),
    password: Joi.string().required(),
    proxy: Joi.number().allow(null),
    dailyLimit: Joi.number().integer().min(1).max(1000).allow(null),
    notes: Joi.string().allow("", null),
  }),

  // DM schemas
  sendDM: Joi.object({
    username: Joi.string()
      .regex(/^[A-Za-z0-9._]{1,30}$/)
      .required(),
    usernames: Joi.array()
      .items(Joi.string().regex(/^[A-Za-z0-9._]{1,30}$/))
      .min(1)
      .max(50)
      .required(),
    message: Joi.string()
      .max(800)
      .when("messageVariations", {
        is: Joi.array().length(0).required(),
        then: Joi.string().required(),
        otherwise: Joi.string().allow("", null),
      }),
    messageVariations: Joi.array()
      .items(Joi.string().max(800))
      .max(10)
      .default([]),
    scheduled: Joi.boolean().default(false),
    scheduleTime: Joi.string().when("scheduled", {
      is: true,
      then: Joi.string().required(),
    }),
  }),

  // Schedule schemas
  scheduleDM: Joi.object({
    fromUsername: Joi.string()
      .regex(/^[A-Za-z0-9._]{1,30}$/)
      .required(),
    targetUsernames: Joi.array()
      .items(Joi.string().regex(/^[A-Za-z0-9._]{1,30}$/))
      .min(1)
      .max(200)
      .required(),
    messageVariations: Joi.array()
      .items(Joi.string().max(800))
      .min(1)
      .max(10)
      .required(),
    scheduleTime: Joi.string().required(),
    isRecurring: Joi.boolean().required(),
    recurringInterval: Joi.when("isRecurring", {
      is: true,
      then: Joi.string()
        .valid("hourly", "daily", "weekly", "monthly")
        .required(),
      otherwise: Joi.allow(null),
    }),
  }),

  // Scraping schemas
  scrapeAccounts: Joi.object({
    postUrl: Joi.string().required(),
    igUsername: Joi.string().required(),
  }),

  scrapePosts: Joi.object({
    postUrl: Joi.string().required(),
    igUsername: Joi.string().required(),
  }),

  scrapeHashtags: Joi.object({
    postUrl: Joi.string().required(),
    igUsername: Joi.string().required(),
    maxPosts: Joi.number().integer().min(1).max(1000).default(100),
  }),

  scrapeKeywords: Joi.object({
    postUrl: Joi.string().required(),
    igUsername: Joi.string().required(),
    maxPosts: Joi.number().integer().min(1).max(1000).default(100),
  }),

  // CRM schemas
  updateContactStatus: Joi.object({
    status: Joi.string()
      .valid("lead", "prospect", "customer", "churned", "blacklisted")
      .required(),
  }),

  recordInteraction: Joi.object({
    type: Joi.string()
      .valid("message_sent", "message_received", "call", "meeting", "other")
      .required(),
    content: Joi.string().required(),
    campaignId: Joi.number().integer().allow(null),
  }),

  // Proxy schemas
  createProxy: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().integer().required(),
    username: Joi.string().allow("", null),
    password: Joi.string().allow("", null),
    type: Joi.string().valid("http", "https", "socks4", "socks5").required(),
  }),
};

// Middleware factory for request validation
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      return res.status(500).json({
        status: "error",
        message: "Internal server error: Invalid schema specified",
      });
    }

    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        status: "error",
        message: "Invalid request data",
        details: error.details.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

module.exports = {
  validate,
};
