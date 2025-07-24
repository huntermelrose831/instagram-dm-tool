// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require("puppeteer-extra");
const path = require("path");
const fs = require("fs").promises; // Add this for cookie handling

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// Random delay function to make bot behavior more human-like
function randomDelay(minMs = 500, maxMs = 5000) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`Waiting ${delay}ms to appear more human...`);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

const loginCredentials = {
  username: "h7328715",
  password: "2010Lilia.",
};
const message = "Hello, this is a test message from my app please ignore!";

const target = "matthewstelling11";
const COOKIES_PATH = path.join(__dirname, "instagram_cookies.json");

puppeteer.launch({ headless: false }).then(async (browser) => {
  console.log("Running tests..");
  const page = await browser.newPage();
  await page.goto("https://www.instagram.com/");
  await randomDelay(); // Random delay before login
  await page.type(
    '[aria-label="Phone number, username, or email"]',
    loginCredentials.username
  );
  await randomDelay(); // Random delay before typing password
  await page.type('[aria-label="Password"]', loginCredentials.password);
  await randomDelay(); // Random delay before clicking login button
  await page.click(
    "#loginForm > div.x9f619.xjbqb8w.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.xqui205.x1n2onr6.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 > div:nth-child(3) > button"
  );
  await page.waitForNavigation({ waitUntil: "networkidle2" });
  if (await page.$('[aria-label="Phone number, username, or email"]')) {
    await page.type(
      '[aria-label="Phone number, username, or email"]',
      loginCredentials.username
    );
    await randomDelay(); // Random delay before typing password
    await page.type('[aria-label="Password"]', loginCredentials.password);
    await randomDelay(); // Random delay before clicking login button
    await page.click(
      "#loginForm > div.x9f619.xjbqb8w.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.xqui205.x1n2onr6.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 > div:nth-child(3) > button"
    );
  }

  await page.goto("https://www.instagram.com/direct/inbox/?hl=en");
  await randomDelay(); // Random delay before clicking not now button
  await page.$$eval("button", (buttons) => {
    for (const button of buttons) {
      if (button.textContent === "Not Now") {
        button.click();
        break; // Clicking the first matching button and exiting the loop
      } else {
        console.log("No 'Not Now' button found, continuing...");
      }
    }
  });
  await page.click('[aria-label="New message"]');
  await randomDelay(); // Random delay before typing in the search box
  await page.keyboard.type(target);

  await randomDelay();
  await page.click('[aria-label="Radio selection"]');

  try {
    await page.$$eval("div[role='button']", (buttons) => {
      for (const button of buttons) {
        if (button.textContent === "Chat") {
          button.click();
          break; // Clicking the first matching button and exiting the loop
        } else {
          console.log("No 'Chat' button found, continuing...");
        }
      }
    });
  } catch (error) {
    console.error("Error clicking 'Chat' button advanced:", error);
  }
  await page.waitForNavigation({ waitUntil: "networkidle2" });
  await randomDelay();
  await page.keyboard.type(message);

  await page.keyboard.press("Enter"); // Change Keyboard to page.keyboard  await page.waitForTimeout(1000);
  await page.screenshot({ path: "screenshot.png" });
  console.log("Message sent successfully!");
  await browser.close();
  console.log(`All done, check the screenshot. ✨`);
});
