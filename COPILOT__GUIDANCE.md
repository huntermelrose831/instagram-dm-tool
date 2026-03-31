# Copilot Guidance for `turbodm`

## This is a standalone Electron desktop application — there is no hosted server, no cloud backend, and no API key authentication.

## Project Purpose

This app is a specialized outreach tool for Instagram, inspired by colddms.com. It enables users to:

- **Scrape usernames** from posts, hashtags, followers, comments, and more.
- **Send automated, personalized DMs** for lead generation campaigns.
- **Organize and track responses** to optimize outreach efforts.

## Key Features

- **Lead Scraping Suite:** Find and filter unlimited leads using accounts, hashtags, keywords, and mentions.
- **Campaign Builder:** Create campaigns with custom message sequences, A/B testing (up to 15 variants per step), and up to 10 follow-ups.
- **Autopilot Messaging:** Automatically message prospects with personalized templates and manage replies in a CRM-like system.
- **Follow-ups:** Automatically stop messaging once a recipient responds.
- **Personalization:** Use variables (like `firstName`, `username`) in messages for higher engagement.

## Design Philosophy

- Prioritize user safety and Instagram compliance.
- Emphasize personalization and intelligent sequencing for best results.
- Make campaign creation and monitoring as simple and powerful as possible.
- Modular code to support new scraping and messaging features.

## Editing Guidance (For Copilot and Contributors)

- **Always preserve core functionality:** scraping, campaign management, messaging, and response tracking.
- **When adding features:** ensure they align with the goal of safe, scalable Instagram outreach.
- **Refactor with care:** maintain compatibility with Instagram's UI/API changes.
- **Document new modules:** especially scraping strategies and message personalization features.
- **Avoid:** adding unrelated social or analytics features, or anything that could increase the risk of Instagram account bans.
- **No API keys or auth middleware** — the backend is localhost-only; there is no need for any `x-api-key` or similar header on fetch calls.

## Success Criteria

- Users can easily find, add, and message targeted leads.
- Campaigns run smoothly and safely with clear feedback and tracking.
- Personalization and A/B testing are easy to use and effective.
- The codebase remains clean, documented, and extensible.

---

> **Note:** This is a different version of colddms.com, adapted for a unique workflow and feature set.
