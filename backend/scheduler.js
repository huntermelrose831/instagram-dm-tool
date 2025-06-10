const cron = require("node-cron");
const {
  getPendingJobs,
  updateJobStatus,
  updateDMCount,
} = require("./database/messaging");
const { sendDMs } = require("./sendDMs");
const accountsStore = require("./accountsStore");

// Instagram's general rate limits (customize these based on your needs)
const RATE_LIMITS = {
  MAX_DMS_PER_DAY: 100,
  MIN_DELAY_BETWEEN_DMS: 60000, // 1 minute in milliseconds
};

// Random delay between messages to avoid detection
const getRandomDelay = () => {
  return Math.floor(Math.random() * (300000 - 60000) + 60000); // Random delay between 1-5 minutes
};

// Process a single message with rate limiting
const processSingleMessage = async (fromUsername, targetUsername, message) => {
  try {
    await sendDMs({
      igUsername: fromUsername,
      usernames: [targetUsername],
      message,
    });
    await updateDMCount(fromUsername);
    return true;
  } catch (error) {
    console.error(`Failed to send DM to ${targetUsername}:`, error);
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

  console.log(`\n=== Processing job #${id} ===`);
  console.log("Job details:", {
    scheduledFor: schedule_time,
    currentTime: new Date().toISOString(),
    fromUser: from_username,
    rawTargets: target_usernames,
    rawMessages: message_variations,
  });

  // Verify account exists and has valid cookies
  const account = accountsStore.getAccountByUsername(from_username);
  if (!account) {
    console.error(`Failed to find account for username: ${from_username}`);
    await updateJobStatus(id, "failed");
    return 0;
  }
  console.log(`Found account for ${from_username}`);

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
    console.log(
      `Starting job #${id} for ${from_username} to send ${targets.length} messages`
    );
    await updateJobStatus(id, "in_progress");

    for (const target of targets) {
      try {
        // Pick a random message variation
        const message = messages[Math.floor(Math.random() * messages.length)];
        console.log(`Sending message to ${target}`);

        const success = await processSingleMessage(
          from_username,
          target,
          message
        );

        if (success) {
          successCount++;
          console.log(`Successfully sent message to ${target}`);
        } else {
          console.log(`Failed to send message to ${target}`);
        }

        // Add random delay between messages
        const delay = getRandomDelay();
        console.log(`Waiting ${delay / 1000} seconds before next message...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (targetError) {
        console.error(`Error sending to ${target}:`, targetError);
        // Continue with next target
      }
    }

    const status =
      successCount === targets.length
        ? "completed"
        : successCount > 0
          ? "partially_completed"
          : "failed";
    await updateJobStatus(id, status);
    console.log(
      `Job #${id} finished with status: ${status} (${successCount}/${targets.length} sent)`
    );
    return successCount;
  } catch (error) {
    console.error(`Critical error in job #${id}:`, error);
    await updateJobStatus(id, "failed");
    return 0;
  }
};

// Check for pending jobs every minute
const checkPendingJobs = async () => {
  console.log(
    "\n--- Checking for pending jobs:",
    new Date().toISOString(),
    "---"
  );
  try {
    const pendingJobs = await getPendingJobs();
    console.log(`Found ${pendingJobs.length} pending jobs`);

    for (const job of pendingJobs) {
      console.log("\nProcessing scheduled job:", {
        id: job.id,
        scheduledTime: job.schedule_time,
        fromUsername: job.from_username,
        targetCount: Array.isArray(job.target_usernames)
          ? job.target_usernames.length
          : JSON.parse(job.target_usernames || "[]").length,
      });

      try {
        await processJob(job);
      } catch (jobError) {
        console.error(`Failed to process job ${job.id}:`, jobError);
        await updateJobStatus(job.id, "failed");
      }
    }
  } catch (error) {
    console.error("Error processing scheduled jobs:", error);
  }
};

// Initialize the scheduler
const initializeScheduler = () => {
  console.log("Initializing DM scheduler...");

  // Run every minute
  cron.schedule("* * * * *", checkPendingJobs);

  // Run immediately on startup
  checkPendingJobs();

  console.log("Scheduler initialized successfully");
};

module.exports = {
  initializeScheduler,
  processJob,
  RATE_LIMITS,
};
