const puppeteer = require("puppeteer");

async function sendDMs({ igUsername, igPassword, targets, message }) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });
  const page = await browser.newPage();

  await page.goto("https://www.instagram.com/accounts/login/", {
    waitUntil: "networkidle2",
  });

  // Login
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.type('input[name="username"]', igUsername, { delay: 100 });
  await page.type('input[name="password"]', igPassword, { delay: 100 });
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  // Wait for home page
  try {
    await page.waitForSelector('svg[aria-label="New post"]', {
      timeout: 15000,
    });
    console.log("Login successful!");
  } catch (e) {
    console.log("Login may have failed or Instagram UI changed.");
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
      await page.waitForTimeout(2000); // Wait for navigation or UI update
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
    { timeout: 15000 }
  );
  await page.click('div[role="button"]:has(svg[aria-label="New message"])');

  // Type the username in the search box
  const target = Array.isArray(targets)
    ? targets[0]
    : targets.split
    ? targets.split(/\r?\n/)[0]
    : targets;
  await page.waitForSelector('input[name="queryBox"]', { timeout: 1500 });
  await page.type('input[name="queryBox"]', target, { delay: 100 });

  // After typing the target username, click the button/label to select the user
  try {
    await page.waitForSelector(
      "div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1pi30zi.x1swvt13.xwib8y2.x1y1aw1k.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 > div > div > div:nth-child(3) > div > label",
      { timeout: 7000 }
    );
    await page.click(
      "div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1pi30zi.x1swvt13.xwib8y2.x1y1aw1k.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 > div > div > div:nth-child(3) > div > label"
    );
    console.log("Clicked target user label after typing username");
  } catch (e) {
    console.log("Could not find/click target user label after typing username");
  }

  // After clicking the label to select the user, click the next button using the provided selector
  try {
    await page.waitForSelector(
      "div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.xw7yly9.xktsk01.x1yztbdb.x1d52u69.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 > div",
      { timeout: 7000 }
    );
    await page.click(
      "div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.xw7yly9.xktsk01.x1yztbdb.x1d52u69.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 > div"
    );
    console.log("Clicked Next button after selecting user");
  } catch (e) {
    console.log("Could not find/click Next button after selecting user");
  }

  // Try multiple selectors for the DM message input
  let messageBoxFound = false;
  const messageSelectors = [
    "textarea",
    'input[aria-label="Message..."]',
    'div[role="textbox"]',
  ];
  for (const selector of messageSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      await page.type(selector, message, { delay: 50 });
      console.log("Typed message in box with selector:", selector);
      messageBoxFound = true;
      break;
    } catch (e) {
      // Try next selector
    }
  }
  if (!messageBoxFound) {
    console.error(
      "Could not find DM message input box. See after_next.png for debugging."
    );
    throw new Error("DM message input not found");
  }

  // After typing the message, try to click the Send button using the provided selector
  let sendButtonFound = false;
  try {
    await page.waitForSelector(
      'div.x1i10hfl.xjqpnuy.xa49m3k.xqeqjp1.x2hbi6w.xdl72j9.x2lah0s.xe8uvvx.xdj266r.x1mh8g0r.x2lwn1j.xeuugli.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x9f619.x1ypdohk.x1f6kntn.xwhw2v2.xl56j7k.x17ydfre.x2b8uid.xlyipyv.x87ps6o.x14atkfc.xcdnw81.x1i0vuye.xjbqb8w.xm3z3ea.x1x8b98j.x131883w.x16mih1h.x972fbf.xcfux6l.x1qhh985.xm0m39n.xt0psk2.xt7dq6l.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x1n2onr6.x1n5bzlp.x173jzuc.x1yc6y37.x7fd4wk.x1sfzahb.xfs2ol5[role="button"]',
      { timeout: 5000 }
    );
    await page.click(
      'div.x1i10hfl.xjqpnuy.xa49m3k.xqeqjp1.x2hbi6w.xdl72j9.x2lah0s.xe8uvvx.xdj266r.x1mh8g0r.x2lwn1j.xeuugli.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x9f619.x1ypdohk.x1f6kntn.xwhw2v2.xl56j7k.x17ydfre.x2b8uid.xlyipyv.x87ps6o.x14atkfc.xcdnw81.x1i0vuye.xjbqb8w.xm3z3ea.x1x8b98j.x131883w.x16mih1h.x972fbf.xcfux6l.x1qhh985.xm0m39n.xt0psk2.xt7dq6l.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x1n2onr6.x1n5bzlp.x173jzuc.x1yc6y37.x7fd4wk.x1sfzahb.xfs2ol5[role="button"]'
    );
    console.log("Clicked Send button using provided selector");
    sendButtonFound = true;
  } catch (e) {
    console.log(
      "Could not find/click Send button using provided selector, trying text-based selector..."
    );
  }

  // Fallback: Click Send button by text content
  if (!sendButtonFound) {
    try {
      await page.waitForFunction(
        () => {
          const buttons = Array.from(
            document.querySelectorAll('div[role="button"]')
          );
          return buttons.some(
            (btn) => btn.innerText.trim().toLowerCase() === "send"
          );
        },
        { timeout: 5000 }
      );
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll('div[role="button"]')
        );
        const sendBtn = buttons.find(
          (btn) => btn.innerText.trim().toLowerCase() === "send"
        );
        if (sendBtn) sendBtn.click();
      });
      console.log("Clicked Send button using text-based selector");
      sendButtonFound = true;
    } catch (e) {
      console.log("Could not find/click Send button using text-based selector");
    }
  }

  if (!sendButtonFound) {
    console.error(
      "Could not find/click Send button. See after_next.png or dm_message_error.png for debugging."
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

module.exports = sendDMs;
