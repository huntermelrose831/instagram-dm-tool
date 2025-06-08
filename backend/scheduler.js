const cron = require("node-cron");
const {
  getPendingJobs,
  updateJobStatus,
  updateDMCount,
} = require("./database");
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
  const { id, from_username, target_usernames, message_variations } = job;
  let targets, messages;

  try {
    targets = JSON.parse(target_usernames);
    messages = JSON.parse(message_variations);
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
    throw error;
  }
};

// Initialize the scheduler
const initializeScheduler = () => {
  console.log("DM Scheduler initialized...");
  // Check for pending jobs every minute
  cron.schedule("* * * * *", async () => {
    try {
      console.log("Checking for pending jobs...");
      const pendingJobs = await getPendingJobs();

      if (pendingJobs.length > 0) {
        console.log(`Found ${pendingJobs.length} jobs to process`);
        for (const job of pendingJobs) {
          console.log(`Processing job #${job.id} for ${job.from_username}`);
          try {
            await processJob(job);
            console.log(`Successfully processed job #${job.id}`);
          } catch (jobError) {
            console.error(`Failed to process job #${job.id}:`, jobError);
          }
        }
      }
    } catch (error) {
      console.error("Error processing scheduled jobs:", error);
    }
  });
};

module.exports = {
  initializeScheduler,
  processJob,
  RATE_LIMITS,
};
