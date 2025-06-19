// const puppeteer = require("puppeteer-extra"); // Removed
// const StealthPlugin = require("puppeteer-extra-plugin-stealth"); // Removed
// const fs = require("fs").promises; // Removed, will be handled by puppeteerHelper if needed for sessions
const path = require("path"); // Added path import

// puppeteer.use(StealthPlugin()); // Removed

const PuppeteerHelper = require("./puppeteerHelper");
const InstagramApi = require("./instagramApi");
const ErrorHandler = require("./errorHandler");

class InstagramService {
  constructor(username) {
    this.puppeteerHelper = new PuppeteerHelper(
      username ? path.join(__dirname, "..", "sessions", username) : undefined
    ); // Pass user-specific session path
    this.instagramApi = new InstagramApi(this.puppeteerHelper);
  }

  async login(username, password) {
    try {
      const loginSuccess = await this.instagramApi.login(username, password);
      if (!loginSuccess) {
        throw ErrorHandler.createError(
          "InstagramService: Login failed",
          false,
          {
            username,
          }
        );
      }
      console.log(`InstagramService: User ${username} logged in successfully.`);
      return true;
    } catch (error) {
      ErrorHandler.handleError(
        error,
        `InstagramService.login (user: ${username})`
      );
      throw error;
    }
  }

  async close() {
    try {
      console.log("InstagramService: Closing service and browser.");
      await this.puppeteerHelper.closeBrowser();
      this.instagramApi.isLoggedIn = false;
      this.instagramApi.currentUser = null;
    } catch (error) {
      ErrorHandler.handleError(error, "InstagramService.close");
    }
  }
}

module.exports = InstagramService;
