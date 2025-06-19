// instagramApi.js
const ErrorHandler = require("./errorHandler");

class InstagramApi {
  constructor(puppeteerHelper) {
    this.puppeteerHelper = puppeteerHelper;
    this.isLoggedIn = false;
    this.currentUser = null;
  }

  async login(username, password) {
    try {
      // Ensure browser is initialized and page is available
      await this.puppeteerHelper.initBrowser();
      const page = this.puppeteerHelper.getPage();

      // Attempt to load existing session first
      const sessionLoaded = await this.puppeteerHelper.loadSession(username);
      if (sessionLoaded) {
        console.log(
          `Attempting to verify session for ${username} (InstagramApi)...`
        );
        await page.goto("https://www.instagram.com/", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await this.puppeteerHelper.humanDelay("navigation");

        // Check if still on login page
        const onLoginPage = await page.evaluate(() =>
          window.location.pathname.includes("/accounts/login/")
        );
        if (!onLoginPage) {
          // Further check: look for a common element that indicates logged-in state, e.g., profile icon
          try {
            await page.waitForSelector('a[href*="/explore/"]', {
              timeout: 5000,
            }); // Example: Explore link
            this.isLoggedIn = true;
            this.currentUser = username;
            console.log(
              `Successfully validated saved session for: ${username} (InstagramApi)`
            );
            return true;
          } catch (e) {
            console.log(
              "Saved session seems invalid (no explore link), proceeding with fresh login (InstagramApi)"
            );
          }
        } else {
          console.log(
            "Saved session redirected to login, proceeding with fresh login (InstagramApi)"
          );
        }
      }

      console.log(`Logging in as ${username} (InstagramApi)...`);
      await page.goto("https://www.instagram.com/accounts/login/", {
        waitUntil: "domcontentloaded", // Changed from networkidle2 for faster initial load
        timeout: 30000,
      });
      await this.puppeteerHelper.humanDelay("navigation"); // Wait for redirects and JS execution

      // Wait for username field, clear it, then type
      await page.waitForSelector('input[name="username"]', {
        visible: true,
        timeout: 15000,
      });
      await page.click('input[name="username"]', { clickCount: 3 }); // Select existing text
      await page.keyboard.press("Backspace"); // Clear field
      await this.puppeteerHelper.humanType('input[name="username"]', username);
      await this.puppeteerHelper.humanDelay("short");

      // Wait for password field, clear it, then type
      await page.waitForSelector('input[name="password"]', {
        visible: true,
        timeout: 10000,
      });
      await page.click('input[name="password"]', { clickCount: 3 });
      await page.keyboard.press("Backspace");
      await this.puppeteerHelper.humanType('input[name="password"]', password);
      await this.puppeteerHelper.humanDelay("short");

      // Wait for the login button to be interactable
      const loginButtonSelector = 'button[type="submit"]';
      await page.waitForSelector(loginButtonSelector, {
        visible: true,
        timeout: 10000,
      });
      await this.puppeteerHelper.humanDelay("click_preparation"); // Small delay before click
      await page.click(loginButtonSelector);
      console.log("Login button clicked (InstagramApi).");

      // Wait for navigation to complete or for an error message
      // Instagram might show "Save Your Login Info?" or "Turn on Notifications?"
      try {
        await page.waitForFunction(
          () => !window.location.href.includes("/accounts/login/"),
          { timeout: 20000 } // Increased timeout
        );
        console.log(
          "Successfully navigated away from login page (InstagramApi)."
        );
      } catch (error) {
        // Check for common login failure indicators
        const loginError = await page.evaluate(() => {
          const errorElement = document.querySelector("#slfErrorAlert"); // Common error div
          return errorElement ? errorElement.textContent : null;
        });
        if (loginError) {
          throw ErrorHandler.createError(`Login failed: ${loginError}`, false, {
            username,
          });
        }
        // If still on login page without a specific error, it's a generic failure
        if (page.url().includes("/accounts/login/")) {
          throw ErrorHandler.createError(
            "Login failed - stuck on login page. Check credentials or account status.",
            false,
            { username }
          );
        }
        // If not a login error, could be a challenge or other issue, let it propagate
        console.warn(
          "Navigation timeout after login click, but not on login page. Checking URL. (InstagramApi)"
        );
      }

      await this.puppeteerHelper.humanDelay("navigation"); // Extra delay for page to settle

      // Handle "Save Your Login Info?" pop-up
      try {
        const saveInfoButtonSelector = "button._acan._acao._acas"; // Common selector for "Save Info" or "Not Now" context
        const saveInfoButton = await page.waitForSelector(
          saveInfoButtonSelector,
          { timeout: 7000 }
        );
        if (saveInfoButton) {
          const buttonText = await page.evaluate(
            (el) => el.textContent,
            saveInfoButton
          );
          console.log(`Found pop-up button: "${buttonText}" (InstagramApi)`);
          // Prefer "Not Now" if available, otherwise click the primary action (which might be "Save Info")
          const notNowButtons = await page.$$("button");
          let clickedNotNow = false;
          for (const btn of notNowButtons) {
            const text = await page.evaluate((el) => el.textContent, btn);
            if (text.toLowerCase().includes("not now")) {
              await btn.click();
              console.log(
                "Clicked 'Not Now' on 'Save Info' pop-up (InstagramApi)."
              );
              clickedNotNow = true;
              break;
            }
          }
          if (!clickedNotNow && buttonText.toLowerCase().includes("save")) {
            // Fallback to clicking "Save Info" if "Not Now" isn't obvious
            await saveInfoButton.click();
            console.log("Clicked 'Save Info' on pop-up (InstagramApi).");
          } else if (!clickedNotNow) {
            // If it's some other button, click it to proceed
            await saveInfoButton.click();
            console.log(
              `Clicked a generic confirmation button: "${buttonText}" (InstagramApi).`
            );
          }
          await this.puppeteerHelper.humanDelay("navigation");
        }
      } catch (e) {
        console.log(
          "'Save Info' pop-up not detected or timed out, continuing (InstagramApi)..."
        );
      }

      // Handle "Turn on Notifications?" pop-up
      try {
        // This often uses role="dialog" and buttons like "Turn On" or "Not Now"
        const notificationDialogSelector = 'div[role="dialog"]';
        await page.waitForSelector(notificationDialogSelector, {
          timeout: 7000,
        });
        console.log("Notification pop-up detected (InstagramApi).");
        // Look for a "Not Now" button within the dialog
        const notNowButtons = await page.$$(
          `${notificationDialogSelector} button`
        );
        let clickedNotNow = false;
        for (const btn of notNowButtons) {
          const text = await page.evaluate((el) => el.textContent, btn);
          if (text.toLowerCase().includes("not now")) {
            await btn.click();
            console.log(
              "Clicked 'Not Now' on notification pop-up (InstagramApi)."
            );
            clickedNotNow = true;
            break;
          }
        }
        if (!clickedNotNow) {
          // If no "Not Now", try to find and click any button to dismiss
          const buttonsInDialog = await page.$$(
            `${notificationDialogSelector} button`
          );
          if (buttonsInDialog.length > 0) {
            await buttonsInDialog[0].click(); // Click the first available button
            console.log(
              "Clicked the first button on notification pop-up to dismiss (InstagramApi)."
            );
          }
        }
        await this.puppeteerHelper.humanDelay("navigation");
      } catch (e) {
        console.log(
          "Notification pop-up not detected or timed out, continuing (InstagramApi)..."
        );
      }

      // Final check for login success
      if (page.url().includes("/challenge/")) {
        throw ErrorHandler.createError(
          "Security challenge required - please complete manually first",
          false,
          { username }
        );
      }
      // Check if we are on the main feed or a recognizable logged-in page
      try {
        await page.waitForFunction(
          () =>
            document.querySelector('a[href="/explore/"]') ||
            document.querySelector('svg[aria-label="Home"]'),
          { timeout: 10000 }
        );
      } catch (e) {
        const finalUrl = page.url();
        console.error(
          `Login may have failed. Final URL: ${finalUrl} (InstagramApi)`
        );
        await this.puppeteerHelper.takeScreenshot("login_failure_final_check");
        throw ErrorHandler.createError(
          `Login verification failed. Ended up on ${finalUrl}. Check screenshot 'login_failure_final_check.png'.`,
          false,
          { username, finalUrl }
        );
      }

      this.isLoggedIn = true;
      this.currentUser = username;
      await this.puppeteerHelper.saveSession(username);
      console.log(`Successfully logged in: ${username} (InstagramApi)`);
      return true;
    } catch (error) {
      ErrorHandler.handleError(error, `InstagramApi.login (user: ${username})`);
      this.isLoggedIn = false;
      throw error;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getIsLoggedIn() {
    return this.isLoggedIn;
  }
}

module.exports = InstagramApi;
