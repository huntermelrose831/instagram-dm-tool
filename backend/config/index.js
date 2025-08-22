const { cleanEnv, str, num, bool } = require("envalid");

// Validate and load environment variables
const env = cleanEnv(process.env, {
  NODE_ENV: str({ default: "development" }),
  PORT: num({ default: 5000 }),
  DB_PATH: str({ default: "./database/dmautomation.db" }),
  API_KEYS_READ: str({ default: "" }), // comma-separated read-only keys
  API_KEYS_MUTATE: str({ default: "" }), // comma-separated mutation keys
  DM_BETWEEN_MIN_MS: num({ default: 5000 }),
  DM_BETWEEN_MAX_MS: num({ default: 15000 }),
  DM_TYPING_MIN_MS: num({ default: 40 }),
  DM_TYPING_MAX_MS: num({ default: 120 }),
  DM_RATE_LIMIT_PAUSE_MS: num({ default: 60000 }),
  DM_INITIAL_COOLDOWN_MS: num({ default: 3000 }),
  DM_ACTION_DELAY_MS: num({ default: 4000 }),
  DM_MAX_RETRIES: num({ default: 2 }),
  DM_MAX_RATE_LIMIT_RETRIES: num({ default: 3 }),
  DM_MAX_CONSECUTIVE_ERRORS: num({ default: 5 }),
  DM_DAILY_ACCOUNT_CAP: num({ default: 200 }),
  USER_AGENTS: str({ default: "" }), // optional pipe-separated list
});

// Parse API key lists and user agents
const parseList = (val) =>
  val
    ? val
        .split(/[,|]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
const readOnlyKeys = new Set(parseList(env.API_KEYS_READ));
const mutateKeys = new Set(parseList(env.API_KEYS_MUTATE));
const userAgents = parseList(env.USER_AGENTS);

const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  dbPath: env.DB_PATH,
  apiKeys: {
    read: readOnlyKeys,
    mutate: mutateKeys,
  },
  dm: {
    delays: {
      typing: { min: env.DM_TYPING_MIN_MS, max: env.DM_TYPING_MAX_MS },
      between: { min: env.DM_BETWEEN_MIN_MS, max: env.DM_BETWEEN_MAX_MS },
      rateLimitPause: env.DM_RATE_LIMIT_PAUSE_MS,
      initialCooldown: env.DM_INITIAL_COOLDOWN_MS,
      action: env.DM_ACTION_DELAY_MS,
    },
    limits: {
      maxRetries: env.DM_MAX_RETRIES,
      maxRateLimitRetries: env.DM_MAX_RATE_LIMIT_RETRIES,
      maxConsecutiveErrors: env.DM_MAX_CONSECUTIVE_ERRORS,
      dailyAccountCap: env.DM_DAILY_ACCOUNT_CAP,
    },
  },
  userAgents,
};

module.exports = config;
