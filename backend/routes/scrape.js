const express = require("express");
const router = express.Router();
const { scrapeProduct } = require("../puppeteerScraper");
const { scrapeFollowers } = require("../followerScraper");
const { scrapeHashtag } = require("../hashtagScraper");
const { scrapeKeyword } = require("../keywordScraper");
const { AccountsService } = require("../database");
const LeadsService = require("../database/leads");

// POST /api/scrape/accounts  — scrape followers from a profile
router.post("/accounts", async (req, res) => {
  const { postUrl, igUsername } = req.body;
  try {
    if (!postUrl || typeof postUrl !== "string") {
      throw new Error("Missing or invalid profile URL");
    }
    if (!igUsername || typeof igUsername !== "string") {
      throw new Error("Missing Instagram username for authentication");
    }
    const usernameMatch = postUrl.match(/instagram\.com\/([^/?]+)/);
    if (!usernameMatch) throw new Error("Invalid Instagram profile URL");
    const targetUsername = usernameMatch[1];

    const followers = await scrapeFollowers(postUrl, igUsername);
    const leads = followers.map((u) => ({
      username: u,
      profileUrl: `https://instagram.com/${u}`,
      timestamp: new Date().toISOString(),
    }));

    let storedCount = 0;
    for (const lead of leads) {
      try {
        await LeadsService.createLead({
          username: lead.username,
          profileUrl: lead.profileUrl,
          source: "instagram_followers",
          sourceUrl: postUrl,
          scrapedAt: lead.timestamp,
        });
        storedCount++;
      } catch (e) {
        if (e.code !== "SQLITE_CONSTRAINT")
          console.error("Store lead error:", e);
      }
    }

    res.json({
      status: "success",
      leads,
      totalFound: followers.length,
      totalStored: storedCount,
      message: `Scraped ${storedCount} followers from ${targetUsername}`,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST /api/scrape/posts  — scrape commenters from a post
router.post("/posts", async (req, res) => {
  try {
    const { postUrl, igUsername } = req.body;
    if (!igUsername) {
      return res.status(400).json({ error: "Instagram username is required" });
    }
    const usernames = await scrapeProduct(postUrl, igUsername);
    const leads = usernames.map((u) => ({
      username: u,
      profileUrl: `https://instagram.com/${u}`,
      source: "instagram_post_comments",
      sourceUrl: postUrl,
      scrapedAt: new Date().toISOString(),
    }));
    res.json({
      status: "success",
      leads,
      totalFound: usernames.length,
      message: `Scraped ${usernames.length} usernames from post comments`,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /api/scrape/hashtags
router.post("/hashtags", async (req, res) => {
  try {
    const { postUrl, igUsername, maxPosts } = req.body;
    if (!postUrl || typeof postUrl !== "string") {
      return res
        .status(400)
        .json({ status: "error", message: "Missing or invalid hashtag input" });
    }
    let accountToUse = igUsername;
    if (!accountToUse) {
      const accounts = AccountsService.getAccounts();
      if (!accounts.length) {
        return res.status(400).json({
          status: "error",
          message:
            "No Instagram accounts available. Please add an account first.",
        });
      }
      accountToUse = accounts[0].username;
    }

    const hashtag = postUrl.replace(/^#/, "").trim();
    if (!hashtag) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid hashtag input" });
    }

    const usernames = await scrapeHashtag(hashtag, accountToUse, maxPosts);
    const leads = usernames.map((u) => ({
      username: u,
      profileUrl: `https://instagram.com/${u}`,
      timestamp: new Date().toISOString(),
    }));

    let storedCount = 0;
    for (const lead of leads) {
      try {
        const result = await LeadsService.createLeadOrIgnore({
          username: lead.username,
          profileUrl: lead.profileUrl,
          source: "instagram_hashtag",
          sourceUrl: `#${hashtag}`,
          scrapedAt: lead.timestamp,
        });
        if (result.inserted) storedCount++;
      } catch (e) {
        console.error("Store lead error:", e);
      }
    }

    res.json({
      status: "success",
      leads,
      totalFound: usernames.length,
      totalStored: storedCount,
      message: `Scraped ${storedCount} usernames from hashtag #${hashtag}`,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /api/scrape/keywords
router.post("/keywords", async (req, res) => {
  try {
    const { postUrl: keywords, igUsername, maxPosts } = req.body;
    if (!keywords || typeof keywords !== "string") {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Missing or invalid keywords input",
        });
    }
    let accountToUse = igUsername;
    if (!accountToUse) {
      const accounts = AccountsService.getAccounts();
      if (!accounts.length) {
        return res.status(400).json({
          status: "error",
          message:
            "No Instagram accounts available. Please add an account first.",
        });
      }
      accountToUse = accounts[0].username;
    }

    const usernames = await scrapeKeyword(keywords, accountToUse, maxPosts);
    const leads = usernames.map((u) => ({
      username: u,
      profileUrl: `https://instagram.com/${u}`,
      timestamp: new Date().toISOString(),
    }));

    let storedCount = 0;
    for (const lead of leads) {
      try {
        await LeadsService.createLead({
          username: lead.username,
          profileUrl: lead.profileUrl,
          source: "instagram_keyword_search",
          sourceUrl: keywords,
          scrapedAt: lead.timestamp,
          notes: `Found via keyword search: ${keywords}`,
        });
        storedCount++;
      } catch (e) {
        if (e.code !== "SQLITE_CONSTRAINT")
          console.error("Store lead error:", e);
      }
    }

    res.json({
      status: "success",
      leads,
      totalFound: usernames.length,
      totalStored: storedCount,
      message: `Found ${storedCount} usernames for keywords: "${keywords}"`,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

module.exports = router;
