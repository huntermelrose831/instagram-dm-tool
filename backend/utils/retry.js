const { delay } = require("./delay");

/**
 * Retries an async operation with exponential backoff
 * @param {Function} fn Async function to retry
 * @param {number} retries Number of retries
 * @param {number} baseDelay Base delay in milliseconds
 * @returns {Promise<any>}
 */
async function retry(fn, retries = 3, baseDelay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      const retryDelay = baseDelay * Math.pow(2, i); // Exponential backoff
      console.log(`Attempt ${i + 1} failed, retrying in ${retryDelay}ms...`);
      await delay(retryDelay);
    }
  }
}
