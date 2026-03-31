# TurboDM - Distribution Guide

## Supported Platforms

Windows and Linux only. macOS is not supported.

TurboDM is a standalone desktop application for Instagram outreach automation that helps you:

- **Generate Leads**: Scrape followers, hashtags, and keywords
- **Send DMs**: Automated direct messaging with rate limiting
- **Manage Accounts**: Multiple Instagram account support
- **Track Analytics**: Monitor your outreach performance
- **Schedule Messages**: Plan your DM campaigns in advance

---

## Installation

### Windows

1. Download `TurboDM Setup 1.0.0.exe`
2. Run the installer (administrator not required)
3. Follow the setup wizard
4. Launch from Start Menu or Desktop shortcut

### macOS

**macOS is not currently supported.** The application does not run on macOS due to compatibility issues with the Puppeteer/Chromium automation layer used for Instagram interactions. Windows and Linux are the supported platforms.

### Linux

1. Download `TurboDM-1.0.0.AppImage`
2. Make it executable: `chmod +x TurboDM-1.0.0.AppImage`
3. Double-click to run or use `./TurboDM-1.0.0.AppImage`
4. For system integration: `./TurboDM-1.0.0.AppImage --appimage-install`

**Alternative Linux (Debian/Ubuntu):**

1. Download `turbodm_1.0.0_amd64.deb`
2. Install: `sudo dpkg -i turbodm_1.0.0_amd64.deb`
3. Launch from Applications menu

---

## Getting Started

### 1. First Launch

- TurboDM creates a local data folder in your user directory
- All accounts, leads, and message history are stored locally — nothing is sent to any cloud service

### 2. Add Instagram Account

- Go to **Accounts** tab
- Click **Add Account**
- Enter your Instagram credentials
- The app saves your login session locally

### 3. Start Lead Generation

- Use the **Leads** tab to scrape followers, hashtags, or keywords
- Review and select users from the results
- Add selected leads to your target list

### 4. Send Messages

- Go to the **Messaging** tab
- Select your target list and account
- Write your message or use variations for A/B testing
- Send immediately or schedule for later

---

## Key Features

### Lead Generation

- **Follower Scraping**: Extract followers from any public Instagram account
- **Hashtag Mining**: Find users who engage with specific hashtags
- **Keyword Search**: Discover users based on keyword searches
- **Smart Filtering**: Remove duplicates and filter by criteria

### Message Automation

- **Bulk Messaging**: Send personalized DMs to hundreds of users
- **Message Variations**: Rotate between different message templates
- **Smart Scheduling**: Plan campaigns for optimal engagement times
- **Rate Limiting**: Built-in safety to avoid Instagram restrictions

### Account Management

- **Multiple Accounts**: Manage unlimited Instagram accounts
- **Session Management**: Secure cookie-based authentication
- **Account Rotation**: Distribute workload across accounts
- **Status Monitoring**: Track account health and limits

### Analytics & Reporting

- **Campaign Tracking**: Monitor message delivery and response rates
- **Lead Pipeline**: Track users from scraped → contacted → replied → converted
- **Export Data**: Download reports in CSV format
- **Performance Metrics**: Detailed statistics on all activities

---

## Safety Features

- **Rate Limiting**: Automatic delays to mimic human behavior
- **Account Protection**: Built-in safeguards to reduce ban risk
- **Local Storage Only**: All data stays on your machine — no cloud sync

---

## System Requirements

### Minimum Requirements

- **Windows**: Windows 10 (64-bit)
- **macOS**: Not supported
- **Linux**: Ubuntu 18.04+ or equivalent
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB available space
- **Internet**: Stable broadband connection

### Recommended Specifications

- **RAM**: 8GB or more
- **Storage**: 1GB available space
- **Processor**: Intel i5 or AMD equivalent
- **Internet**: High-speed broadband for optimal performance

---

## Troubleshooting

- **Login fails**: Ensure 2FA is disabled on the Instagram account, or use a saved session cookie
- **App won’t open (Linux)**: Run `chmod +x TurboDM-*.AppImage` before launching
- **Puppeteer/Chrome crash**: Ensure at least 4 GB RAM is free; close other Chrome windows
- **Blank screen on launch**: Wait ~10 seconds for the backend to start, then reload

---

## License

This software is licensed for commercial use. Each license permits installation on one computer.

Use responsibly and in compliance with Instagram’s Terms of Service. Do not use for spam or unsolicited bulk messaging.

---

## Ready to Get Started?

1. **Download** the installer for your operating system (Windows or Linux)
2. **Install** following the instructions above
3. **Launch** TurboDM
4. **Add** your first Instagram account
5. **Start** generating leads and growing your outreach
