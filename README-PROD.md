# Instagram DM Tool - Production Notes

This document covers production-relevant details for the Electron desktop application.

## Supported Platforms

- Windows 10+ (64-bit) — distributed as `.exe` installer
- Linux (Ubuntu 18.04+) — distributed as `.AppImage` or `.deb`
- macOS is not supported

## Tech Stack

- **Frontend**: React 19, Tailwind CSS, Chart.js, React Router 7, Framer Motion
- **Backend**: Node.js, Express 4, SQLite3, Puppeteer (stealth), node-cron, Socket.io, Winston
- **Desktop**: Electron, electron-builder

## Building for Production

Install all dependencies first:

```bash
npm install
cd backend && npm install && cd ..
```

Build and package:

```bash
# Current platform
bash build-app.sh

# Windows specifically
bash build-app.sh win

# Linux specifically
bash build-app.sh linux
```

Output is placed in `dist-electron/`.

## Environment Configuration

Create `backend/.env` before running or packaging:

| Variable    | Default        | Description               |
| ----------- | -------------- | ------------------------- |
| `PORT`      | `5001`         | Backend API port          |
| `DATA_DIR`  | `backend/data` | SQLite database directory |
| `NODE_ENV`  | `production`   | Environment               |
| `LOG_LEVEL` | `warn`         | Winston log level         |

In the packaged Electron app, the backend process runs as a child process of the main Electron process. The `DATA_DIR` defaults to a directory inside the user's app data folder so data persists across updates.

## Security

- HTTP headers hardened via Helmet
- All API inputs validated with Joi and sanitized with sanitize-html
- Express rate limiting on all routes
- Additional rate limiting on unknown/unmatched routes to slow scanners
- Winston access logs written to the OS temp directory

## Database Maintenance

Run a manual database backup at any time:

```bash
cd backend && node backup-db.js
```

The backup script copies the SQLite database file to a timestamped file in the same data directory.

## Logs

Logs are written to the OS temp directory under `instagram-dm-tool/logs/`:

- `main.log` — Electron main process log
- `access.log` — HTTP access log (Morgan)
- `app.log` — Application log (Winston)

## License

Commercial - see [LICENSE.txt](LICENSE.txt) for details.
