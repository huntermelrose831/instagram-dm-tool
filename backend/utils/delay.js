/**
 * Creates a delay with random jitter to make automation less detectable
 * @param {number} ms Base delay in milliseconds
 * @returns {Promise<void>}
 */
const delay = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, Math.floor(ms + Math.random() * (ms * 0.2)))
  );

/**
 * Adds random delays between actions to mimic human behavior
 * @param {number} min Minimum delay in milliseconds
 * @param {number} max Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
const randomDelay = (min = 1000, max = 3000) => {
  const jitter = Math.floor(Math.random() * (max - min + 1) + min);
  return delay(jitter);
};

module.exports = {
  delay,
  randomDelay,
};
