# Instagram DM Tool

A desktop application for Instagram direct messaging automation, lead generation, and account management. Built with Electron, React, and a Node.js/Express backend.

## Screenshots

![Dashboard](assets/icons/Screenshot%20from%202026-03-25%2010-59-27.png)

![Messaging](assets/icons/Screenshot%20from%202026-03-25%2010-59-46.png)

![Leads & Targets](assets/icons/Screenshot%20from%202026-03-25%2011-00-02.png)

## How It Works

The app is packaged as an Electron desktop application. When launched, Electron spawns the Node.js/Express backend as a child process (running on port 5001) and loads the React frontend in a Chromium window. The frontend communicates with the backend over a local HTTP API (`/api/*`). During development, Vite's dev server proxies `/api` requests to the backend.

Instagram interactions are performed through Puppeteer with the stealth plugin, which controls a headless Chromium instance to send DMs, scrape followers/hashtags/keywords, and monitor message replies. All data is persisted in a local SQLite database stored in the app's data directory.

## Features

- **Messaging**: Send DMs manually or schedule them with configurable rate limits and delays
- **Targets**: Build and manage lists of Instagram users to message
- **Leads**: Track scraped users through a status pipeline (new, contacted, replied, converted)
- **Accounts**: Manage multiple Instagram accounts with per-account rate limit tracking and proxy assignment
- **CRM**: Log interactions and notes against contacts
- **Reports**: Export messaging activity, lead data, and account stats
- **Team Collaboration**: Role-based user access with shared data

## Technology Stack

### Frontend

- React 19 with React Router 7
- Tailwind CSS
- Chart.js, Recharts
- Framer Motion
- React Icons

### Backend

- Node.js with Express 4
- SQLite3 (via `sqlite3` package)
- Puppeteer + `puppeteer-extra-plugin-stealth` for Instagram automation
- `node-cron` for scheduled DM jobs
- Socket.io for real-time status updates
- Winston for logging
- Helmet, express-rate-limit for security

### Desktop

- Electron (main process spawns backend, loads Vite-built frontend)
- electron-builder for packaging to AppImage (Linux) and .exe (Windows)
- macOS is not supported

## Project Structure

```
instagram-dm-tool/
├── electron/
│   ├── main.cjs          # Electron main process - spawns backend, creates window
│   └── preload.cjs       # Preload script with context bridge
├── src/                  # React frontend
│   ├── App.jsx           # Router and layout
│   ├── Navbar.jsx        # Sidebar navigation
│   ├── Home.jsx          # Dashboard
│   ├── Messaging.jsx     # Send and schedule DMs
│   ├── Targets.jsx       # Target list management
│   ├── Leads.jsx         # Lead pipeline
│   ├── Accounts.jsx      # Instagram account management
│   ├── CRM.jsx           # Contact notes and interaction log
│   ├── ReportingExport.jsx
│   ├── TeamCollaboration.jsx
│   ├── ScheduleDM.jsx
│   ├── components/
│   │   └── ProgressModal.jsx
│   └── contexts/
│       └── AppStateContext.jsx
├── backend/
│   ├── server.js         # Express app, all API routes
│   ├── sendDMs.js        # DM sending logic via Puppeteer
│   ├── scheduler.js      # node-cron job scheduler for DMs
│   ├── messageMonitor.js # Polls for new DM replies
│   ├── followerScraper.js
│   ├── hashtagScraper.js
│   ├── keywordScraper.js
│   ├── puppeteerScraper.js
│   ├── login.js          # Instagram login via Puppeteer
│   ├── setup.js          # First-run database setup
│   ├── backup-db.js
│   ├── migrate-targets.js
│   ├── config/
│   │   └── index.js
│   ├── database/
│   │   ├── db.js         # SQLite initialization and table creation
│   │   ├── accounts.js
│   │   ├── leads.js
│   │   ├── messaging.js
│   │   ├── crm.js
│   │   ├── targets.js
│   │   ├── proxies.js
│   │   ├── ratelimits.js
│   │   ├── reports.js
│   │   ├── scraping.js
│   │   └── team.js
│   ├── routes/
│   │   └── team.js
│   ├── services/
│   │   └── accountService.js
│   └── utils/
│       ├── delay.js
│       ├── logger.js
│       ├── middleware.js
│       ├── retry.js
│       ├── selectors.js
│       └── validator.js
├── assets/
│   └── icons/            # App icons and screenshots
├── scripts/              # Build and packaging helpers
├── public/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── package.json          # Frontend + Electron deps and build scripts
└── backend/package.json  # Backend deps
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install Dependencies

```bash
# Install frontend + Electron dependencies
npm install

# Install backend dependencies
cd backend && npm install
```

### Development

Start the backend and frontend separately:

```bash
# Terminal 1 - backend
cd backend && npm run dev

# Terminal 2 - frontend (Vite dev server, proxies /api to localhost:5001)
npm run dev
```

Or run in Electron with hot reload:

```bash
npm run electron-dev
```

### Build

```bash
# Build frontend assets
npm run build

# Package as Electron app (current platform)
npm run build-electron

# Package for all platforms
npm run release:all
```

Built distributables are output to `dist-electron/`.

## Configuration

The backend reads from a `.env` file in the `backend/` directory. Key variables:

| Variable    | Default        | Description               |
| ----------- | -------------- | ------------------------- |
| `PORT`      | `5001`         | Backend API port          |
| `DATA_DIR`  | `backend/data` | SQLite database directory |
| `NODE_ENV`  | `development`  | Environment               |
| `LOG_LEVEL` | `info`         | Winston log level         |

## License

Commercial - see [LICENSE.txt](LICENSE.txt) for details.

---

\*\*
