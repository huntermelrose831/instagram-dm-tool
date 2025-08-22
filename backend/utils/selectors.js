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
    'textarea[placeholder="Message..."]',
    'input[placeholder="Message..."]',
    'div[contenteditable="true"][aria-label="Message"][role="textbox"]',
    'div[contenteditable="true"][placeholder="Message..."]',
  ],

  SEND_BUTTON: [
    'button[type="submit"]',
    'div[role="button"][aria-label="Send Message"]',
    'div[role="button"] button:has-text("Send")',
    'button[type="button"]:not([disabled])',
    'div[role="button"]:not([disabled]):has-text("Send")',
    '//*[@id=\"mount_0_0_ZO\"]/div/div/div[2]/div/div/div[1]/div[1]/div[1]/section/main/section/div/div/div/div[1]/div/div[2]/div/div/div[1]/div/div[2]/div[2]/div/div/div/div[3]',
  ],

  SEARCH_BOX: [
    'div[role="dialog"] input[placeholder*="Search"]',
    'input[type="text"]',
    'input[placeholder*="Search"]',
    'input[aria-label*="Search"]',
    'input[name="queryBox"]',
    'div[contenteditable="true"]',
  ],

  NOT_NOW_BUTTON: [
    "button._a9--._ap36._a9_1", // original, works in some login modals
    'button:has-text("Not Now")', // more flexible fallback
    "#mount_0_0_ky > div > div > div.x9f619.x1n2onr6.x1ja2u2z > div > div > div.x78zum5.xdt5ytf.x1t2pt76.x1n2onr6.x1ja2u2z.x10cihs4 > div.x9f619.xvbhtw8.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.x1q0g3np.xqjyukv.x1qjc9v5.x1oa3qoh.x1qughib > div.x1gryazu.xh8yej3.x10o80wk.x14k21rp.x1v4esvl.x8vgawa > section > main > section > div > div > div > div.xjp7ctv > div > div.x9f619.x1n2onr6.x1ja2u2z.x78zum5.xdt5ytf.x2lah0s.x193iq5w.xeuugli.xvbhtw8 > div > div.x6s0dn4.x1bs97v6.x1q0q8m5.x9f619.xat24cr.xh8yej3.x1qhh985.x14z7g9a.xzbw6zd.x78zum5.x1q0g3np.x1qughib.xsag5q8.xbbxn1n.xxbr6pl.xijc0j3 > div.x78zum5.x13a6bvl.x1ye3gou > div > div > div > svg",
  ],

  SEARCH_RESULTS: [
    'input[aria-label*="Radio selection"][type="checkbox"]',
    'div[role="dialog"] div[role="none"] div[role="button"]',
    'div[role="dialog"] div[aria-label*="suggested"] div[role="button"]',
    'div[role="dialog"] div[role="list"] div[role="listitem"]',
    'div[role="dialog"] button:has(img)',
  ],

  CHAT_BUTTON: [
    'div[role="button"] button:nth-child(2)',
    'button[tabindex="0"]:has-text("Next")',
    'button:has-text("Next")',
    'div[role="dialog"] button[type="button"]',
    'button[type="button"]:not([disabled])',
    'div[role="dialog"] button:has-text("Send")',
  ],
  NEWMESSAGEBUTTON: [
    'svg[aria-label="New message"]',
    'div[role="button"][aria-label="New message"]',
    'button[aria-label="New message"]',
    'a[aria-label="New message"]',
    // Alternative text labels
    'svg[aria-label="New Message"]',
    'div[role="button"][aria-label="New Message"]',
    'button[aria-label="New Message"]',
    // Look for compose/new/create buttons in DM context
    'svg[aria-label*="Compose"]',
    'div[role="button"][aria-label*="Compose"]',
    'svg[aria-label*="Create"]',
    'div[role="button"][aria-label*="Create"]',
    // Generic new message patterns
    'button:has-text("New message")',
    'button:has-text("New Message")',
    'div[role="button"]:has-text("New message")',
    'div[role="button"]:has-text("New Message")',
    // SVG icon-based fallbacks (common Instagram patterns)
    'svg[viewBox="0 0 24 24"] + span:has-text("New")',
    'div[role="button"] svg[viewBox="0 0 24 24"]',
    // Path-based selectors for common Instagram locations
    'header div[role="button"] svg',
    'div[data-testid*="new"] svg',
    'div[data-testid*="compose"] svg',
    // Broader fallbacks if rate limited
    'div[role="button"][tabindex="0"]',
    'button[type="button"]:not([disabled])',
  ],

  DIRECT_MESSAGING_LINK: [
    'a[aria-label="Direct messaging - 0 new notifications link"]',
    'a[aria-label*="Direct messaging"]',
    'a[aria-label*="Messenger"]',
    'a[href="/direct/inbox/"]',
    'svg[aria-label="Messenger"]',
    'svg[aria-label="Direct"]',
  ],
};

/**
 * Tries multiple selectors until one works
 * @param {import('puppeteer').Page} page Puppeteer page
 * @param {string[]} selectors Array of selectors to try
 * @param {object} options Waiting options
 * @returns {Promise<string>} Working selector
 */
async function findWorkingSelector(
  page,
  selectors,
  options = { timeout: 5000 }
) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, options);
      return selector;
    } catch (e) {
      continue;
    }
  }
  throw new Error("No working selector found");
}

/**
 * Checks if an element is actually interactable
 * @param {import('puppeteer').Page} page Puppeteer page
 * @param {string} selector Element selector
 * @returns {Promise<boolean>}
 */
async function isElementInteractable(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;

    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      el.offsetParent !== null
    );
  }, selector);
}

module.exports = {
  SELECTORS,
  findWorkingSelector,
  isElementInteractable,
};
