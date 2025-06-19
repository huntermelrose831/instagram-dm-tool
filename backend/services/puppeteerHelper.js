// puppeteerHelper.js
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs").promises;
const path = require("path");
const ErrorHandler = require("./errorHandler");

puppeteer.use(StealthPlugin());

class PuppeteerHelper {
  constructor(sessionPath) {
    this.browser = null;
    this.page = null;
    this.sessionPath = sessionPath || path.join(__dirname, "..", "sessions");
  }

  async initBrowser(options = {}) {
    const defaultOptions = {
      headless: false, // Changed for debugging - will open a visible browser
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        // '--single-process', // This can cause issues, consider removing if problems persist
        "--disable-gpu",
        `--user-data-dir=${this.userDataDir}`,
      ],
      userDataDir: this.userDataDir,
      executablePath: puppeteer.executablePath(), // Explicitly use bundled Chromium
      dumpio: true, // Log browser process stdout/stderr
    };

    const launchOptions = { ...defaultOptions, ...options };

    try {
      if (this.browser && this.browser.connected) {
        return;
      }
      await fs.mkdir(this.sessionPath, { recursive: true });

      this.browser = await puppeteer.launch(launchOptions);

      this.page = await this.browser.newPage();
      await this.applyStealthMeasures();
      console.log("Browser initialized successfully by PuppeteerHelper");
    } catch (error) {
      ErrorHandler.handleError(error, "PuppeteerHelper.initBrowser");
      throw error;
    }
  }

  async applyStealthMeasures() {
    await this.page.evaluateOnNewDocument(() => {
      delete navigator.__proto__.webdriver;
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
      window.chrome = { runtime: {} };
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await this.page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });
  }

  async humanDelay(type = "normal") {
    const delays = {
      short: () => 500 + Math.random() * 1000,
      normal: () => 1000 + Math.random() * 2000,
      read: () => 2000 + Math.random() * 3000,
      type: () => 50 + Math.random() * 100,
      click: () => 100 + Math.random() * 300,
      navigation: () => 3000 + Math.random() * 2000,
    };
    const delay = delays[type] ? delays[type]() : delays.normal();
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async humanType(selector, text) {
    try {
      const element = await this.page.$(selector);
      if (!element) {
        throw ErrorHandler.createError(`Element not found: ${selector}`);
      }
      await element.click();
      await this.humanDelay("click");
      await this.page.keyboard.down("Control");
      await this.page.keyboard.press("a");
      await this.page.keyboard.up("Control");
      await this.humanDelay("short");
      for (const char of text) {
        await this.page.keyboard.type(char);
        await this.humanDelay("type");
      }
    } catch (error) {
      ErrorHandler.handleError(
        error,
        `PuppeteerHelper.humanType (selector: ${selector})`
      );
      throw error;
    }
  }

  async saveSession(username) {
    try {
      const cookies = await this.page.cookies();
      const sessionData = {
        cookies,
        userAgent: await this.page.evaluate(() => navigator.userAgent),
        timestamp: Date.now(),
      };
      const sessionFile = path.join(this.sessionPath, `${username}.json`);
      await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
      console.log(`Session saved for ${username} by PuppeteerHelper`);
    } catch (error) {
      ErrorHandler.handleError(error, "PuppeteerHelper.saveSession");
      // Not throwing, as this is not always critical
    }
  }

  async loadSession(username) {
    try {
      const sessionFile = path.join(this.sessionPath, `${username}.json`);
      const sessionData = JSON.parse(await fs.readFile(sessionFile, "utf8"));
      const sessionAge = Date.now() - sessionData.timestamp;
      if (sessionAge > 24 * 60 * 60 * 1000) {
        console.log("Session too old, will need to re-login (PuppeteerHelper)");
        return false;
      }
      await this.page.setCookie(...sessionData.cookies);
      console.log(`Session loaded for ${username} by PuppeteerHelper`);
      return true;
    } catch (error) {
      console.log(`No valid session found for ${username} (PuppeteerHelper)`);
      return false;
    }
  }

  async checkBrowserConnection() {
    try {
      if (!this.browser || !this.browser.connected) {
        console.log(
          "Browser disconnected, reinitializing (PuppeteerHelper)..."
        );
        await this.initBrowser();
        return false;
      }
      if (!this.page || this.page.isClosed()) {
        console.log("Page closed, creating new page (PuppeteerHelper)...");
        this.page = await this.browser.newPage();
        await this.applyStealthMeasures(); // Re-apply measures to new page
        return false;
      }
      await this.page.evaluate(() => document.title); // Test responsiveness
      return true;
    } catch (error) {
      console.error(
        "Page not responsive or browser issue, reinitializing (PuppeteerHelper)..."
      );
      try {
        await this.initBrowser(); // This will create a new page as well
      } catch (reinitError) {
        ErrorHandler.handleError(
          reinitError,
          "PuppeteerHelper.checkBrowserConnection - reinitialization failed"
        );
      }
      return false;
    }
  }

  async closeBrowser() {
    try {
      if (this.browser && this.browser.connected) {
        await this.browser.close();
        console.log("Browser closed by PuppeteerHelper");
      }
    } catch (error) {
      ErrorHandler.handleError(error, "PuppeteerHelper.closeBrowser");
    } finally {
      this.browser = null;
      this.page = null;
    }
  }

  getPage() {
    if (!this.page || this.page.isClosed()) {
      throw ErrorHandler.createError("Page is not available or closed.", true);
    }
    return this.page;
  }
}

module.exports = PuppeteerHelper;
