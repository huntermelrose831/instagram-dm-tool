const cron = require("node-cron");
const {
  getPendingJobs,
  updateJobStatus,
  updateDMCount,
} = require("./database/messaging");
const { sendDMs } = require("./sendDMs");
const accountsStore = require("./accountsStore");
const logger = require("./utils/logger");

// Instagram's general rate limits (customize these based on your needs)
const RATE_LIMITS = {
  MAX_DMS_PER_DAY: 100,
  MIN_DELAY_BETWEEN_DMS: 5000, // 5 seconds in milliseconds
};

// Random delay between messages to avoid detection (5s to 30s)
const getRandomDelay = () => {
  return Math.floor(Math.random() * (30000 - 5000 + 1) + 5000); // 5s to 30s
};

// Process a single message with rate limiting
const processSingleMessage = async (fromUsername, targetUsername, message) => {
  try {
    logger.debug(`Sending DM from ${fromUsername} to ${targetUsername}`);
    const result = await sendDMs({
      igUsername: fromUsername,
      usernames: [targetUsername],
      message,
    });

    // Check if the message was actually sent
    const messageWasSent = result && result.successCount > 0;

    if (messageWasSent) {
      // Update DM count only if message was actually sent
      try {
        await updateDMCount(fromUsername);
      } catch (dmCountError) {
        logger.warn(
          `Failed to update DM count for ${fromUsername}: ${dmCountError.message}`
        );
        // Don't fail the message send because of DM count update failure
      }
    }

    return messageWasSent;
  } catch (error) {
    logger.error(`Failed to send DM to ${targetUsername}: ${error.message}`);
    return false;
  }
};

// Process a job with multiple targets
const processJob = async (job) => {
  const {
    id,
    from_username,
    target_usernames,
    message_variations,
    schedule_time,
  } = job;
  let targets, messages;

  logger.debug(`Processing job #${id} from ${from_username}`);

  // Verify account exists and has valid cookies
  // Remove @ prefix if present
  const cleanUsername = from_username.replace(/^@/, "");

  // Check available accounts with minimal logging
  const allAccounts = accountsStore.loadAccounts();
  const { AccountsService } = require("./database");
  const dbAccounts = AccountsService.getAccounts();

  logger.debug(`Looking for account: ${cleanUsername}`);

  // Try different variations of the username in JSON store first
  let account = accountsStore.getAccountByUsername(cleanUsername);

  if (!account) {
    // Try with @gmail.com suffix
    account = accountsStore.getAccountByUsername(`${cleanUsername}@gmail.com`);
    logger.debug(`Trying with @gmail.com: ${cleanUsername}@gmail.com`);
  }

  if (!account) {
    // Try finding any account that starts with the username
    account = allAccounts.find((acc) => acc.username.startsWith(cleanUsername));
    logger.debug(`Trying to find account starting with: ${cleanUsername}`);
  }

  // If not found in JSON store, try database (but we need cookies for Instagram)
  if (!account) {
    const dbAccount = AccountsService.getAccountByUsername(cleanUsername);
    if (dbAccount && dbAccount.cookies) {
      account = dbAccount;
      logger.debug(`Found account in database: ${dbAccount.username}`);
    }
  }

  if (!account) {
    logger.error(
      `Failed to find account for username: ${from_username} (cleaned: ${cleanUsername})`
    );
    logger.error(
      `Available accounts: ${[...allAccounts, ...dbAccounts].map((acc) => acc.username).join(", ")}`
    );
    await updateJobStatus(id, "failed");
    return 0;
  }

  logger.debug(`Found account: ${account.username}`);

  try {
    targets = Array.isArray(target_usernames)
      ? target_usernames
      : JSON.parse(target_usernames);
    messages = Array.isArray(message_variations)
      ? message_variations
      : JSON.parse(message_variations);

    console.log(`Successfully parsed job data:`, {
      targetsCount: targets.length,
      messagesCount: messages.length,
    });
  } catch (error) {
    console.error(`Failed to parse job data for job #${id}:`, error);
    await updateJobStatus(id, "failed");
    return 0;
  }

  let successCount = 0;

  try {
    logger.info(
      `Starting job #${id} for ${from_username} to send ${targets.length} messages`
    );
    await updateJobStatus(id, "running");

    for (const target of targets) {
      try {
        // Pick a random message variation
        const message = messages[Math.floor(Math.random() * messages.length)];
        logger.debug(`Sending message to ${target}`);
        const success = await processSingleMessage(
          account.username,
          target,
          message
        );

        if (success) {
          successCount++;
          logger.debug(`Successfully sent message to ${target}`);
        } else {
          logger.warn(`Failed to send message to ${target}`);
        }

        // Add random delay between messages
        const delay = getRandomDelay();
        logger.debug(`Waiting ${delay / 1000} seconds before next message...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (targetError) {
        logger.error(`Error sending to ${target}: ${targetError.message}`);
        // Continue with next target
      }
    }
    const status =
      successCount === targets.length
        ? "completed"
        : successCount > 0
          ? "completed" // Partial success - still mark as completed but log details
          : "failed";
    await updateJobStatus(id, status);
    logger.info(
      `Job #${id} finished: ${status} (${successCount}/${targets.length} sent)${
        successCount > 0 && successCount < targets.length
          ? " - PARTIAL SUCCESS"
          : ""
      }`
    );
    return successCount;
  } catch (error) {
    logger.error(`Critical error in job #${id}: ${error.message}`);
    await updateJobStatus(id, "failed");
    return 0;
  }
};

// Timeout wrapper for job processing to prevent stuck jobs
const processJobWithTimeout = async (job, timeoutMs = 600000) => {
  // 10 minute timeout
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      logger.error(
        `Job #${job.id} timed out after ${timeoutMs / 1000} seconds`
      );
      try {
        updateJobStatus(job.id, "failed");
      } catch (err) {
        logger.error(`Error updating job status after timeout: ${err.message}`);
      }
      reject(
        new Error(`Job processing timed out after ${timeoutMs / 1000} seconds`)
      );
    }, timeoutMs);

    try {
      const result = await processJob(job);
      clearTimeout(timeout);
      resolve(result);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
};

// Check for pending jobs every minute
const checkPendingJobs = async () => {
  const now = new Date();

  try {
    const pendingJobs = await getPendingJobs();

    // Only log when there are actual jobs to process
    if (pendingJobs.length > 0) {
      logger.logScheduler(
        `Found ${pendingJobs.length} pending jobs ready to execute`
      );

      for (const job of pendingJobs) {
        logger.info(
          `🚀 Executing scheduled job #${job.id} from ${job.from_username}`
        );
        try {
          await processJobWithTimeout(job);
        } catch (jobError) {
          logger.error(
            `❌ Failed to process job ${job.id}: ${jobError.message}`
          );
          // Ensure job status is updated to failed if not already done
          try {
            await updateJobStatus(job.id, "failed");
          } catch (statusError) {
            logger.error(
              `Failed to update job ${job.id} status to failed: ${statusError.message}`
            );
          }
        }
      }
    } else {
      // Only log "no jobs" message every 10 minutes to reduce noise
      const minute = now.getMinutes();
      if (minute % 10 === 0) {
        logger.debug("✅ No jobs ready to execute");
      }
    }
  } catch (error) {
    logger.error("❌ Error processing scheduled jobs:", error);
  }
};

// Clean up jobs that have been stuck in "running" state for too long
const cleanupStuckJobs = async () => {
  try {
    const db = require("./database/db");

    // Find jobs that have been "running" for more than 15 minutes
    const stuckJobs = db
      .prepare(
        `
      SELECT id, from_username, schedule_time, created_at
      FROM scheduled_jobs 
      WHERE status = 'running' 
      AND datetime(created_at, '+15 minutes') < datetime('now')
    `
      )
      .all();

    if (stuckJobs.length > 0) {
      console.log(`Found ${stuckJobs.length} stuck jobs, marking as failed...`);

      for (const job of stuckJobs) {
        console.log(`Cleaning up stuck job #${job.id} (${job.from_username})`);
        await updateJobStatus(job.id, "failed");
      }
    }
  } catch (error) {
    console.error("Error cleaning up stuck jobs:", error.message);
  }
};

// Initialize scheduler and clean up stuck jobs
const initializeScheduler = async () => {
  console.log("🚀 Initializing DM scheduler...");

  // Clean up any stuck jobs from previous runs
  await cleanupStuckJobs();

  // Start the job checker
  console.log("📅 Starting scheduled job checker (runs every minute)");

  // Run immediately then every minute
  await checkPendingJobs();

  // Schedule to run every minute
  cron.schedule("* * * * *", checkPendingJobs);

  console.log("✅ Scheduler initialized successfully");
};

module.exports = {
  initializeScheduler,
  processJob,
  processSingleMessage,
  cleanupStuckJobs,
  RATE_LIMITS,
};
