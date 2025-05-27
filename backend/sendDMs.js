const puppeteer = require("puppeteer");
const accountsStore = require("./accountsStore");

// Refactored: sendDMs now uses stored cookies for session, not username/password
async function sendDMs({ igUsername, usernames, message }) {
  const account = accountsStore.getAccountByUsername(igUsername);
  if (!account || !account.cookies) {
    throw new Error(
      "No cookies found for this account. Please log in and save the session first."
    );
  }
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });
  const page = await browser.newPage();
  await page.setCookie(...account.cookies);
  await page.goto("https://www.instagram.com/", { waitUntil: "networkidle2" });

  // Wait for home page (check for DM icon or New Post icon)
  try {
    await page.waitForSelector(
      'svg[aria-label="New post"], svg[aria-label="Direct"], svg[aria-label="Messenger"]',
      {
        timeout: 15000,
      }
    );
    console.log("Session loaded, logged in!");
  } catch (e) {
    console.log("Session cookies may be expired or Instagram UI changed.");
    await browser.close();
    throw new Error("Session invalid or expired. Please re-login.");
  }

  // Handle "Save Your Login Info?" popup

  // Try multiple selectors for the DM (paper plane) icon
  let dmButtonFound = false;
  const dmSelectors = [
    'a[href="/direct/inbox/"]',
    'svg[aria-label="Direct"]',
    'svg[aria-label="Messenger"]',
    'a[aria-label="Direct"]',
    'a[aria-label="Messenger"]',
  ];
  for (const selector of dmSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 50 });
      await page.click(selector);
      await page.waitFor(2000); // Wait for navigation or UI update
      console.log("Clicked DM button with selector:", selector);
      dmButtonFound = true;
      break;
    } catch (e) {
      // Try next selector
    }
  }

  // After opening the DM page, click the Not Now button if present
  try {
    await page.waitForSelector("button._a9--._ap36._a9_1", { timeout: 7000 });
    await page.click("button._a9--._ap36._a9_1");
    console.log("Clicked Not Now button after opening DM page");
  } catch (e) {
    console.log("No Not Now button appeared after opening DM page");
  }

  // Click "Send Message" or "New Message"
  await page.waitForSelector(
    'div[role="button"]:has(svg[aria-label="New message"])',
    { timeout: 20000 }
  );
  await page.click('div[role="button"]:has(svg[aria-label="New message"])');

  // Wait for the DM search box (try multiple selectors, longer timeout)
  const searchBoxSelectors = [
    'input[name="queryBox"]',
    'input[placeholder="Search..."]',
    'input[aria-label="Search"]',
    'input[type="text"]',
  ];
  let searchBoxFound = false;
  for (const selector of searchBoxSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 6000 });
      searchBoxFound = selector;
      break;
    } catch (e) {
      // Try next selector
    }
  }
  if (!searchBoxFound) {
    await page.screenshot({ path: "dm_searchbox_error.png" });
    throw new Error(
      "Could not find DM search box. See dm_searchbox_error.png for debugging."
    );
  }

  // Type the username(s) in the search box and select each user
  let targetsArray = Array.isArray(usernames)
    ? usernames
    : typeof usernames === "string"
      ? usernames
          .split(/\r?\n|,|;/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  for (const target of targetsArray) {
    await page.type(searchBoxFound, target, { delay: 100 });
    // Wait for and click the user label after typing username
    try {
      await page.waitForSelector(
        "div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1pi30zi.x1swvt13.xwib8y2.x1y1aw1k.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 > div > div > div:nth-child(3) > div > label",
        { timeout: 7000 }
      );
      await page.click(
        "div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1pi30zi.x1swvt13.xwib8y2.x1y1aw1k.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 > div > div > div:nth-child(3) > div > label"
      );
      console.log(`Selected user: ${target}`);
    } catch (e) {
      console.log(`Could not find/click user label for: ${target}`);
    }
    // Clear the search box for the next username
    await page.evaluate((selector) => {
      const input = document.querySelector(selector);
      if (input) input.value = "";
    }, searchBoxFound);
  }

  // After selecting all users, click the Next button
  try {
    await page.waitForSelector(
      "div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.xw7yly9.xktsk01.x1yztbdb.x1d52u69.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 > div",
      { timeout: 7000 }
    );
    await page.click(
      "div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.xw7yly9.xktsk01.x1yztbdb.x1d52u69.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 > div"
    );
    console.log("Clicked Next button after selecting users");
    // Wait for loading spinner to disappear (if present)
    try {
      await page.waitForFunction(
        () => {
          // Look for a generic spinner or loading indicator
          const spinners = document.querySelectorAll(
            '[aria-label="Loading"], .x1iyjqo2, ._aacl._aacn._aacu._aacx._aad7._aade'
          );
          return Array.from(spinners).every(
            (spinner) => spinner.offsetParent === null
          );
        },
        { timeout: 10000 }
      );
      console.log("Loading spinner disappeared");
    } catch (e) {
      console.log("No loading spinner or it did not disappear in time");
    }
  } catch (e) {
    console.log("Could not find/click Next button after selecting users");
  }

  // Try multiple selectors for the DM message input, wait up to 15s
  let messageBoxFound = false;
  const messageSelectors = [
    "textarea",
    'input[aria-label="Message..."]',
    'div[role="textbox"]',
    'div[contenteditable="true"]',
  ];
  for (const selector of messageSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 15000 });
      await page.type(selector, message, { delay: 50 });
      console.log("Typed message in box with selector:", selector);
      messageBoxFound = true;
      break;
    } catch (e) {
      // Try next selector
    }
  }
  if (!messageBoxFound) {
    await page.screenshot({ path: "dm_messagebox_error.png" });
    console.error(
      "Could not find DM message input box. See dm_messagebox_error.png for debugging."
    );
    throw new Error("DM message input not found");
  }

  // After typing the message, try to click the Send button using multiple selectors and enabled state
  let sendButtonFound = false;
  const sendButtonSelectors = [
    'div[role="button"]',
    'button[type="submit"]',
    "button",
    'div[aria-label="Send Message"]',
  ];
  for (const selector of sendButtonSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      // Find a button with text 'Send' and enabled
      const clicked = await page.evaluate((sel) => {
        const btns = Array.from(document.querySelectorAll(sel));
        const sendBtn = btns.find(
          (btn) =>
            btn.innerText &&
            btn.innerText.trim().toLowerCase() === "send" &&
            !btn.disabled &&
            (!btn.hasAttribute("aria-disabled") ||
              btn.getAttribute("aria-disabled") === "false")
        );
        if (sendBtn) {
          sendBtn.click();
          return true;
        }
        return false;
      }, selector);
      if (clicked) {
        console.log("Clicked Send button using selector:", selector);
        sendButtonFound = true;
        break;
      }
    } catch (e) {
      // Try next selector
    }
  }
  if (!sendButtonFound) {
    await page.screenshot({ path: "dm_send_error.png" });
    console.error(
      "Could not find/click Send button. See dm_send_error.png for debugging."
    );
    throw new Error("Send button not found");
  }

  // After typing the message, click the Send button using the provided selector (div with many classes and role="button")
  try {
    await page.waitForSelector(
      'div.x1i10hfl.xjqpnuy.xa49m3k.xqeqjp1.x2hbi6w.xdl72j9.x2lah0s.xe8uvvx.xdj266r.x1mh8g0r.x2lwn1j.xeuugli.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x9f619.x1ypdohk.x1f6kntn.xwhw2v2.xl56j7k.x17ydfre.x2b8uid.xlyipyv.x87ps6o.x14atkfc.xcdnw81.x1i0vuye.xjbqb8w.xm3z3ea.x1x8b98j.x131883w.x16mih1h.x972fbf.xcfux6l.x1qhh985.xm0m39n.xt0psk2.xt7dq6l.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x1n2onr6.x1n5bzlp.x173jzuc.x1yc6y37.x7fd4wk.x1sfzahb.xfs2ol5[role="button"]',
      { timeout: 10000 }
    );
    await page.click(
      'div.x1i10hfl.xjqpnuy.xa49m3k.xqeqjp1.x2hbi6w.xdl72j9.x2lah0s.xe8uvvx.xdj266r.x1mh8g0r.x2lwn1j.xeuugli.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x9f619.x1ypdohk.x1f6kntn.xwhw2v2.xl56j7k.x17ydfre.x2b8uid.xlyipyv.x87ps6o.x14atkfc.xcdnw81.x1i0vuye.xjbqb8w.xm3z3ea.x1x8b98j.x131883w.x16mih1h.x972fbf.xcfux6l.x1qhh985.xm0m39n.xt0psk2.xt7dq6l.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x1n2onr6.x1n5bzlp.x173jzuc.x1yc6y37.x7fd4wk.x1sfzahb.xfs2ol5[role="button"]'
    );
    console.log("Clicked Send button using provided selector");
  } catch (e) {
    console.log("Could not find/click Send button using provided selector");
  }

  console.log("DM sent to:", target);
  await browser.close(); // Commented out to keep browser open for inspection
}

async function scrapeInbox(username) {
  const account = accountsStore.getAccountByUsername(username);
  if (!account || !account.cookies)
    throw new Error("No cookies for this account. Please log in first.");

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();

  try {
    await page.setCookie(...account.cookies);
    console.log("Navigating to Instagram main page...");

    await page.goto("https://www.instagram.com/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Check for DM icon to verify login
    await page.waitForSelector(
      'svg[aria-label="Direct"], svg[aria-label="Messenger"], a[href="/direct/inbox/"]',
      { timeout: 10000 }
    );

    console.log("Successfully verified login, going to inbox...");

    // Navigate to inbox
    await page.goto("https://www.instagram.com/direct/inbox/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Handle any "Not Now" popups
    try {
      await page.waitForSelector("button._a9--._ap36._a9_1", { timeout: 7000 });
      await page.click("button._a9--._ap36._a9_1");
      console.log("Clicked Not Now button after opening DM page");
    } catch (e) {
      console.log("No Not Now button appeared after opening DM page");
    }

    // Enhanced inbox selectors that match current Instagram UI
    const inboxSelectors = [
      'div[role="tablist"]',
      'div[aria-label="Direct messaging"]',
      'div[aria-label="Chats"]',
      "div._aano",
      "div.x7r02ix.xf1ldfh.x131esax.xdajt7p.xxfnqb6.xb88tzc.xw2csxc.x1odjw0f.x5fp0pe > div > div",
      'div[style*="height: 100%"][style*="width: 100%"]',
    ];

    // Try each selector until we find one that works
    let loaded = false;
    for (const selector of inboxSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 15000 });
        console.log(`Found inbox with selector: ${selector}`);
        loaded = true;
        break;
      } catch (e) {
        console.log(`Selector ${selector} not found, trying next...`);
      }
    }

    if (!loaded) {
      console.log("Taking error screenshot...");
      await page.screenshot({ path: "inbox_load_error.png", fullPage: true });
      throw new Error("Could not find inbox messages");
    }

    // Wait for dynamic content to load

    // Get conversation threads with improved selectors
    const threads = await page.evaluate(() => {
      const threadContainers = [
        ...document.querySelectorAll('a[href^="/direct/t/"]'),
        ...document.querySelectorAll('div[role="row"]'),
        ...document.querySelectorAll("div.x1n2onr6.x1ja2u2z"),
        ...document.querySelectorAll('div._aano div[style*="height"]'),
      ];

      return threadContainers
        .map((thread) => {
          const threadLink =
            thread.querySelector('a[href^="/direct/t/"]') || thread;
          const threadId = threadLink.getAttribute("href");

          // Enhanced participant detection
          const participants = Array.from(
            thread.querySelectorAll(
              'span[dir="auto"], div._aacl._aaco._aacu._aacx._aad7._aade, h3, h4'
            )
          )
            .map((el) => el.textContent.trim())
            .filter(Boolean);

          // Better message preview detection
          const lastMessageEl = thread.querySelector(
            'div[dir="auto"] > span, div._aacl._aaco._aacu._aacx._aad7._aade > span, div[data-testid="message-preview"]'
          );
          const timestampEl = thread.querySelector(
            'time, div._aacl._aaco._aacu._aacx._aad7._aade, span[style*="color: rgb(142, 142, 142)"]'
          );

          return {
            threadId,
            preview: {
              participants,
              lastMessage: lastMessageEl
                ? lastMessageEl.textContent.trim()
                : "",
              timestamp: timestampEl
                ? timestampEl.getAttribute("datetime") ||
                  timestampEl.textContent.trim()
                : "",
            },
          };
        })
        .filter((t) => t.threadId); // Only keep threads with valid IDs
    });

    console.log(`Found ${threads.length} conversations`);

    // Process each thread
    const conversations = [];
    for (const thread of threads) {
      try {
        console.log(`Fetching messages for thread: ${thread.threadId}`);
        await page.goto(`https://www.instagram.com${thread.threadId}`, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        // Wait for messages to load with multiple selectors
        const messageSelectors = [
          'div[role="listitem"]',
          "div._aacl._aaco._aacu._aacx._aad7._aade",
          'div[data-testid="message-container"]',
        ];

        let messagesLoaded = false;
        for (const selector of messageSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 10000 });
            messagesLoaded = true;
            break;
          } catch (e) {
            continue;
          }
        }

        if (!messagesLoaded) {
          throw new Error("Messages not found");
        }

        await autoScroll(page);

        // Get messages with improved selectors
        const messages = await page.evaluate(() => {
          return Array.from(
            document.querySelectorAll(
              'div[role="listitem"], div._aacl._aaco._aacu._aacx._aad7._aade, div[data-testid="message-container"]'
            )
          )
            .map((msg) => ({
              user:
                msg.querySelector('h3, span[dir="auto"], a[role="link"]')
                  ?.textContent || "",
              text:
                msg.querySelector(
                  'div[dir="auto"] > span, div[dir="auto"], div[data-testid="message-content"]'
                )?.textContent || "",
              time:
                msg
                  .querySelector(
                    'time, span[style*="color: rgb(142, 142, 142)"]'
                  )
                  ?.getAttribute("datetime") ||
                msg.querySelector(
                  'time, span[style*="color: rgb(142, 142, 142)"]'
                )?.textContent ||
                "",
              isLiked: !!msg.querySelector(
                'div[aria-label="Like"], svg[aria-label="Like"]'
              ),
              hasPicture: !!msg.querySelector("img"),
              isStory: !!msg.querySelector(
                'text[aria-label*="story"], div[aria-label*="story"]'
              ),
              isPost: !!msg.querySelector(
                'text[aria-label*="post"], div[aria-label*="post"]'
              ),
            }))
            .filter((m) => m.text || m.hasPicture || m.isStory || m.isPost);
        });

        conversations.push({
          threadId: thread.threadId,
          participants: thread.preview.participants,
          messages: messages.reverse(),
          lastMsg: messages[messages.length - 1] || null,
        });

        console.log(`Retrieved ${messages.length} messages from conversation`);
      } catch (error) {
        console.error(
          `Error fetching messages for thread ${thread.threadId}:`,
          error
        );
        conversations.push({
          threadId: thread.threadId,
          participants: thread.preview.participants,
          error: "Failed to load messages",
          lastMsg: {
            text: thread.preview.lastMessage,
            time: thread.preview.timestamp,
          },
        });
      }
    }

    console.log(`Successfully scraped ${conversations.length} conversations`);
    await browser.close();
    return conversations;
  } catch (error) {
    console.error("Error in scrapeInbox:", error);
    await page.screenshot({ path: "inbox_error.png", fullPage: true });
    await browser.close();
    throw new Error(`Failed to load inbox: ${error.message}`);
  }
}

async function scrapeMessages(page) {
  console.log("Starting message scraping...");

  // Wait for message container to load with multiple selectors
  const messageContainerSelectors = [
    'div[role="listbox"]',
    "div._aano",
    'div[aria-label="Chats"]',
    'div[data-testid="message-container"]',
    "div.x7r02ix.xf1ldfh.x131esax.xdajt7p.xxfnqb6.xb88tzc.xw2csxc.x1odjw0f.x5fp0pe",
  ];

  let containerFound = false;
  for (const selector of messageContainerSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
      console.log(`Found message container with selector: ${selector}`);
      containerFound = true;
      break;
    } catch (e) {
      console.log(`Selector ${selector} not found, trying next...`);
    }
  }

  if (!containerFound) {
    console.log("Taking error screenshot...");
    await page.screenshot({
      path: "message_container_error.png",
      fullPage: true,
    });
    throw new Error("Could not find message container");
  }

  // Scroll to load message history
  await autoScroll(page);

  // Extract messages with enhanced selectors
  const messages = await page.evaluate(() => {
    const messageElements = [
      ...document.querySelectorAll('div[role="listitem"]'),
      ...document.querySelectorAll("div._aacl._aaco._aacu._aacx._aad7._aade"),
      ...document.querySelectorAll('div[data-testid="message-container"]'),
      ...document.querySelectorAll("div.x1n2onr6.x1ja2u2z"),
    ];

    return messageElements
      .map((msg) => {
        try {
          // Enhanced username detection with new selector
          const senderElement =
            msg.querySelector(
              ".x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft"
            ) || msg.querySelector('h3, span[dir="auto"], a[role="link"]');
          const sender = senderElement?.textContent?.trim() || "";

          // Enhanced message content detection
          const textContent =
            msg
              .querySelector(
                'div[dir="auto"] > span, div[dir="auto"], div[data-testid="message-content"]'
              )
              ?.textContent?.trim() ||
            msg.querySelector('span[dir="auto"]')?.textContent?.trim() ||
            "";

          // Improved media content detection
          const mediaElements = msg.querySelectorAll("img, video");
          const media = Array.from(mediaElements)
            .map((el) => ({
              type: el.tagName.toLowerCase(),
              url: el.src || el.getAttribute("data-src") || "",
              alt: el.alt || "",
            }))
            .filter((m) => m.url);

          // Better timestamp detection
          const timestamp =
            msg.querySelector("time")?.getAttribute("datetime") ||
            msg.querySelector("time")?.textContent?.trim() ||
            msg
              .querySelector('span[style*="color: rgb(142, 142, 142)"]')
              ?.textContent?.trim() ||
            "";

          // Additional metadata detection
          const isLiked = !!msg.querySelector(
            'div[aria-label="Like"], svg[aria-label="Like"]'
          );
          const isStory = !!msg.querySelector(
            'text[aria-label*="story"], div[aria-label*="story"]'
          );
          const isPost = !!msg.querySelector(
            'text[aria-label*="post"], div[aria-label*="post"]'
          );
          const isReply = !!msg.querySelector(
            'div[aria-label*="reply"], span[aria-label*="reply"]'
          );

          return {
            sender,
            timestamp,
            content: textContent,
            media: media.length > 0 ? media : null,
            metadata: {
              isLiked,
              isStory,
              isPost,
              isReply,
            },
          };
        } catch (error) {
          console.log("Error processing message:", error);
          return null;
        }
      })
      .filter((m) => m && (m.content || m.media)); // Filter out null and empty messages
  });

  console.log(`Scraped ${messages.length} messages`);
  return messages;
}

async function autoScroll(page) {
  console.log("Starting auto-scroll to load message history...");

  await page.evaluate(async () => {
    const messageContainer = document.querySelector(
      [
        'div[role="listbox"]',
        "div._aano",
        'div[style*="height: 100%"][style*="width: 100%"]',
        "div.x7r02ix.xf1ldfh.x131esax.xdajt7p.xxfnqb6.xb88tzc.xw2csxc.x1odjw0f.x5fp0pe > div > div",
      ].join(",")
    );

    if (!messageContainer) {
      console.log("Message container not found for scrolling");
      return;
    }

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let previousHeight = messageContainer.scrollHeight;
    let unchangedCount = 0;
    const maxUnchangedCount = 3;
    const maxAttempts = 15;
    let attempts = 0;

    while (attempts < maxAttempts && unchangedCount < maxUnchangedCount) {
      // Scroll to top
      messageContainer.scrollTop = 0;
      await delay(1500); // Wait longer for content to load

      const currentHeight = messageContainer.scrollHeight;
      console.log(
        `Scroll attempt ${attempts + 1}/${maxAttempts} - Height: ${currentHeight}`
      );

      if (currentHeight === previousHeight) {
        unchangedCount++;
        console.log(
          `No height change detected (${unchangedCount}/${maxUnchangedCount})`
        );
      } else {
        unchangedCount = 0;
        console.log("New content loaded");
      }

      previousHeight = currentHeight;
      attempts++;
    }

    if (unchangedCount >= maxUnchangedCount) {
      console.log("Reached top of conversation (no more new content)");
    } else if (attempts >= maxAttempts) {
      console.log("Reached maximum scroll attempts");
    }
  });

  // Wait for any remaining content to load
  await page.waitFor(2000);
}

module.exports = { sendDMs, scrapeInbox };
