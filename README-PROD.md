# TurboDM - Production Notes

This document covers production-relevant details for the TurboDM Electron desktop application.

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

Create `backend/.env` before running or packaging (optional — all values have sensible defaults):

| Variable    | Default        | Description               |
| ----------- | -------------- | ------------------------- |
| `PORT`      | `5001`         | Backend API port          |
| `DATA_DIR`  | `backend/data` | SQLite database directory |
| `NODE_ENV`  | `production`   | Environment               |
| `LOG_LEVEL` | `warn`         | Winston log level         |

The backend runs as a child process of the Electron main process. `DATA_DIR` defaults to the user's app data folder so data persists across updates.

## Security

This is a local desktop application — the Express backend only listens on localhost and is never exposed to the network. Input validation is handled with Joi and sanitize-html. Winston access logs are written to the OS temp directory.

## Database Maintenance

Run a manual database backup at any time:

```bash
cd backend && node backup-db.js
```

The backup script copies the SQLite database file to a timestamped file in the same data directory.

## Logs

Logs are written to the OS temp directory under `turbodm/logs/`:

- `main.log` — Electron main process log
- `access.log` — HTTP access log (Morgan)
- `app.log` — Application log (Winston)

## License

Commercial - see [LICENSE.txt](LICENSE.txt) for details.
