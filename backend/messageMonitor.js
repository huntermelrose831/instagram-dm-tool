const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { addCampaignReply } = require("./database/messaging");
const { delay } = require("./utils/delay");
const { SELECTORS } = require("./utils/selectors");
const accountsStore = require("./accountsStore");

puppeteer.use(StealthPlugin());

class MessageMonitor {
  constructor() {
    this.activeMonitors = new Map(); // username -> monitor instance
    this.isMonitoring = false;
  }

  async startMonitoring(username) {
    if (this.activeMonitors.has(username)) {
      console.log(`Monitor already active for ${username}`);
      return;
    }

    console.log(`Starting message monitor for ${username}`);
    
    try {
      const monitor = await this.createMonitorInstance(username);
      this.activeMonitors.set(username, monitor);
      
      // Start monitoring loop
      this.monitorMessages(username, monitor);
      
    } catch (error) {
      console.error(`Failed to start monitor for ${username}:`, error);
    }
  }

  async createMonitorInstance(username) {
    const account = accountsStore.getAccountByUsername(username);
    if (!account) {
      throw new Error(`Account not found: ${username}`);
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Login to Instagram
    await this.loginToInstagram(page, account);
    
    // Navigate to messages
    await page.goto("https://www.instagram.com/direct/inbox/");
    await delay(3000);

    return { browser, page, account };
  }

  async loginToInstagram(page, account) {
    await page.goto("https://www.instagram.com/accounts/login/");
    await delay(2000);

    // Fill login form
    await page.type('input[name="username"]', account.username);
    await delay(500);
    await page.type('input[name="password"]', account.password);
    await delay(500);

    // Submit login
    await page.click('button[type="submit"]');
    await delay(5000);

    // Handle potential 2FA or verification
    try {
      const currentUrl = page.url();
      if (currentUrl.includes("challenge")) {
        console.log("Manual verification required for", account.username);
        // Could implement 2FA handling here if needed
      }
    } catch (error) {
      console.log("Login verification check failed:", error.message);
    }
  }

  async monitorMessages(username, monitor) {
    const { page } = monitor;
    let lastMessageCount = 0;

    while (this.activeMonitors.has(username)) {
      try {
        // Check for new messages
        const conversations = await this.getConversations(page);
        
        for (const conversation of conversations) {
          await this.processConversation(page, conversation, username);
        }

        // Wait before next check
        await delay(10000); // Check every 10 seconds
        
      } catch (error) {
        console.error(`Error monitoring messages for ${username}:`, error);
        await delay(30000); // Wait longer on error
      }
    }
  }

  async getConversations(page) {
    try {
      // Get list of conversations from inbox
      const conversationElements = await page.$$('[role="listitem"]');
      const conversations = [];

      for (let i = 0; i < Math.min(conversationElements.length, 10); i++) {
        try {
          const element = conversationElements[i];
          const hasUnread = await element.$('.x1n2onr6') !== null; // Unread indicator
          
          if (hasUnread) {
            const usernameElement = await element.$('[dir="auto"]');
            const username = usernameElement ? await page.evaluate(el => el.textContent, usernameElement) : null;
            
            if (username) {
              conversations.push({
                element,
                username: username.trim(),
                hasUnread: true
              });
            }
          }
        } catch (error) {
          // Skip this conversation if we can't parse it
          continue;
        }
      }

      return conversations;
    } catch (error) {
      console.error("Error getting conversations:", error);
      return [];
    }
  }

  async processConversation(page, conversation, monitorUsername) {
    try {
      // Click on the conversation
      await conversation.element.click();
      await delay(2000);

      // Get latest messages
      const messages = await this.getLatestMessages(page);
      
      for (const message of messages) {
        if (message.isFromOther && message.isNew) {
          await this.processIncomingMessage(
            message,
            conversation.username,
            monitorUsername,
            page
          );
        }
      }

      // Go back to inbox
      await page.goBack();
      await delay(1000);

    } catch (error) {
      console.error(`Error processing conversation with ${conversation.username}:`, error);
    }
  }

  async getLatestMessages(page) {
    try {
      // Get message elements from the conversation
      const messageElements = await page.$$('[data-testid="message-container"]');
      const messages = [];

      // Only check the last few messages to avoid processing old ones
      const recentMessages = messageElements.slice(-5);

      for (const element of recentMessages) {
        try {
          const messageText = await page.evaluate(el => {
            const textElement = el.querySelector('[dir="auto"]');
            return textElement ? textElement.textContent : '';
          }, element);

          // Determine if message is from the other person
          const isFromOther = await page.evaluate(el => {
            // Instagram messages from others typically have different styling
            return !el.classList.contains('x1n2onr6'); // Adjust selector as needed
          }, element);

          if (messageText && isFromOther) {
            messages.push({
              text: messageText.trim(),
              isFromOther: true,
              isNew: true, // For now, treat as new (could add timestamp checking)
              element
            });
          }
        } catch (error) {
          continue; // Skip this message if we can't parse it
        }
      }

      return messages;
    } catch (error) {
      console.error("Error getting messages:", error);
      return [];
    }
  }

  async processIncomingMessage(message, fromUsername, monitorUsername, page) {
    try {
      console.log(`New message from ${fromUsername}: "${message.text}"`);

      // Automation features removed

      // Record the message in campaign replies if applicable
      await this.recordIncomingMessage(message, fromUsername, monitorUsername);

    } catch (error) {
      console.error(`Error processing message from ${fromUsername}:`, error);
    }
  }



  async sendResponse(page, messageText) {
    try {
      // Find message input field
      const messageInput = await page.waitForSelector('div[contenteditable="true"]', { timeout: 5000 });
      
      if (messageInput) {
        // Clear any existing text
        await page.evaluate(el => el.textContent = '', messageInput);
        
        // Type the response
        await messageInput.type(messageText);
        await delay(1000);

        // Send the message
        const sendButton = await page.$('button[type="submit"]');
        if (sendButton) {
          await sendButton.click();
          await delay(2000);
        }
      }
    } catch (error) {
      console.error("Error sending response:", error);
      throw error;
    }
  }

  personalizeMessage(template, username) {
    // Replace placeholders in the message template
    return template
      .replace(/\{username\}/gi, username)
      .replace(/\{name\}/gi, username)
      .replace(/\{user\}/gi, username);
  }

  async recordIncomingMessage(message, fromUsername, monitorUsername) {
    try {
      // This could be enhanced to link with specific campaigns
      // For now, just record as a general reply
      await addCampaignReply({
        campaign_id: null, // Could be linked to active campaigns
        username: fromUsername,
        message_content: '', // The original message we sent (if any)
        reply_content: message.text,
        sentiment: 'neutral', // Could add sentiment analysis
        is_read: true,
        received_at: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error recording incoming message:", error);
    }
  }

  async stopMonitoring(username) {
    const monitor = this.activeMonitors.get(username);
    if (monitor) {
      try {
        await monitor.browser.close();
        this.activeMonitors.delete(username);
        console.log(`Stopped monitoring for ${username}`);
      } catch (error) {
        console.error(`Error stopping monitor for ${username}:`, error);
      }
    }
  }

  async stopAllMonitoring() {
    const usernames = Array.from(this.activeMonitors.keys());
    for (const username of usernames) {
      await this.stopMonitoring(username);
    }
  }

  getActiveMonitors() {
    return Array.from(this.activeMonitors.keys());
  }
}

// Create singleton instance
const messageMonitor = new MessageMonitor();

module.exports = {
  MessageMonitor,
  messageMonitor
};
