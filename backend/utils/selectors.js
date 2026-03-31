/**
 * Common Instagram selectors used across the application
 */
const SELECTORS = {
  DM_BUTTONS: [
    'a[href="/direct/inbox/"]',
    'svg[aria-label="Direct"]',
    'svg[aria-label="Messenger"]',
    'a[aria-label="Direct"]',
    'a[aria-label="Messenger"]',
  ],

  MESSAGE_BOX: [
    'div[contenteditable="true"][aria-label*="Message"]',
    'div[contenteditable="true"][data-testid*="message"]',
    'textarea[placeholder="Message..."]',
    'input[placeholder="Message..."]',
    'div[contenteditable="true"][aria-label="Message"][role="textbox"]',
    'div[contenteditable="true"][placeholder="Message..."]',
    'div[role="textbox"]',
  ],

  SEND_BUTTON: [
    'button[type="submit"]',
    'div[role="button"][aria-label="Send Message"]',
    'div[role="button"]:has-text("Send")',
    'button:has-text("Send")',
    'button[type="button"]:not([disabled])',
    'div[role="button"]:not([disabled]):has-text("Send")',
    '[data-testid="send-button"]',
  ],

  SEARCH_BOX: [
    // Prioritize the specific search input for DM compose
    'input[name="queryBox"]',
    'input[placeholder="Search..."]',
    'input[autocomplete="off"][placeholder="Search..."]',
    // Fallback selectors
    'input[placeholder*="Search"]',
    'input[aria-label*="Search"]',
    'input[type="text"]',
    'div[role="dialog"] input[placeholder*="Search"]',
    'input[aria-label*="Search"]',
    'div[contenteditable="true"]',
  ],

  NOT_NOW_BUTTON: [
    "button._a9--._ap36._a9_1", // original, works in some login modals
    'button:has-text("Not Now")', // more flexible fallback
    'button[type="button"]:has-text("Not Now")',
    'div[role="button"]:has-text("Not Now")',
  ],

  SEARCH_RESULTS: [
    // Confirmed working selector for DM compose search results
    'input[name="ContactSearchResultCheckbox"]',
    'input[aria-label="Radio selection"]',
    // Current Instagram DM compose search result rows
    'div[role="dialog"] div[role="button"]',
    'div[role="listbox"] div[role="option"]',
    'div[role="option"]',
    'div[role="dialog"] div[role="none"] div[role="button"]',
    'div[role="dialog"] div[aria-label*="suggested"] div[role="button"]',
    'input[type="checkbox"][tabindex="-1"]',
  ],

  CHAT_BUTTON: [
    // Specific class structure for Chat button
    'div.x1i10hfl[role="button"]',
    'div[role="button"]:has-text("Chat")',
    'button:has-text("Chat")',
    'button[type="button"]',
    '[data-testid="chat-button"]',
    'div[role="button"]',
  ],

  NEWMESSAGEBUTTON: [
    'svg[aria-label="New message"]',
    'button[aria-label="New message"]',
    'div[role="button"][aria-label="New message"]',
    'a[aria-label="New message"]',
    '[data-testid="new-message-button"]',
  ],

  DIRECT_MESSAGING_LINK: [
    'a[aria-label="Direct messaging - 0 new notifications link"]',
    'a[aria-label*="Direct messaging"]',
    'a[aria-label*="Messenger"]',
    'a[href="/direct/inbox/"]',
    'svg[aria-label="Messenger"]',
    'svg[aria-label="Direct"]',
  ],

  // Authentication check selectors
  LOGIN_FORM: [
    "form#loginForm",
    'input[name="username"]',
    'input[aria-label*="username"]',
    'input[placeholder*="username"]',
  ],

  LOGGED_IN_INDICATORS: [
    'svg[aria-label="New post"]',
    'svg[aria-label="Messenger"]',
    'a[href*="/direct/"]',
    'svg[aria-label="Home"]',
    'svg[aria-label="Search"]',
    'img[alt*="profile picture"]',
    '[aria-label="Settings"]',
  ],
};

/**
 * Helper function to find a working selector from an array of selectors
 * @param {Object} page - Puppeteer page object
 * @param {string[]} selectors - Array of CSS selectors to try
 * @param {number} timeout - Total timeout in milliseconds
 * @returns {Promise<ElementHandle>} The found element
 */
async function findWorkingSelector(page, selectors, timeout = 5000) {
  if (!page || page.isClosed()) {
    throw new Error("Page is closed or detached");
  }

  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
  const timeoutPerSelector = Math.max(1000, timeout / selectorArray.length);

  for (const selector of selectorArray) {
    try {
      console.log(`Trying selector: ${selector}`);
      const element = await page.waitForSelector(selector, {
        timeout: timeoutPerSelector,
        visible: true,
      });
      if (element) {
        console.log(`✓ Found element with selector: ${selector}`);
        return element;
      }
    } catch (e) {
      console.log(`✗ Selector failed: ${selector}`);
      continue;
    }
  }

  throw new Error(`None of the selectors found: ${selectorArray.join(", ")}`);
}

/**
 * Check if an element is interactable (visible and not disabled)
 * @param {Object} page - Puppeteer page object
 * @param {ElementHandle} element - The element to check
 * @returns {Promise<boolean>} Whether the element is interactable
 */
async function isElementInteractable(page, element) {
  if (!element) return false;

  try {
    const isVisible = await element.isIntersectingViewport();
    const isEnabled = await page.evaluate((el) => {
      return !el.disabled && el.offsetParent !== null;
    }, element);

    return isVisible && isEnabled;
  } catch (error) {
    console.warn("Error checking element interactability:", error.message);
    return false;
  }
}

module.exports = {
  SELECTORS,
  findWorkingSelector,
  isElementInteractable,
};
