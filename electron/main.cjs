const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const authService = require("./authService.cjs");

const isWindows = process.platform === "win32";

// Centralized logging (console + file)
let logStream;
function initLogger(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const logPath = path.join(dir, "main.log");
    logStream = fs.createWriteStream(logPath, { flags: "a" });
    log(`Logger initialized at: ${logPath}`);
  } catch (e) {
    console.error("Failed to initialize logger:", e);
  }
}
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ")}`;
  try {
    console.log(line);
    logStream?.write(line + os.EOL);
  } catch (_) {}
}
function logError(...args) {
  const line = `[${new Date().toISOString()}] ERROR: ${args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ")}`;
  try {
    console.error(line);
    logStream?.write(line + os.EOL);
  } catch (_) {}
}

let mainWindow;
let backendProcess;

function normalize(p) {
  // Ensure platform-correct separators
  if (!p) return p;
  return isWindows
    ? path.win32.normalize(p)
    : path.posix.normalize(p.replace(/\\/g, "/"));
}

function createWindow() {
  try {
    // Create the browser window
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, "preload.cjs"),
      },
      show: false, // Don't show until ready
      titleBarStyle: "default",
      autoHideMenuBar: true,
    });

    // Load the app
    const isDev = process.env.ELECTRON_IS_DEV === "true" || !app.isPackaged;
    if (isDev) {
      log("Loading renderer from Vite dev server");
      mainWindow.loadURL("http://localhost:5173"); // Vite dev server
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
      // In packaged apps, dist/ and electron/ are siblings inside app.asar.
      // __dirname = resources/app.asar/electron  →  ../dist/index.html is correct.
      let indexPath = normalize(path.join(__dirname, "../dist/index.html"));

      log("Loading renderer from file:", indexPath);
      log("App is packaged:", app.isPackaged);
      log("Resources path:", process.resourcesPath);
      log("__dirname:", __dirname);

      // Check if file exists before loading
      try {
        if (fs.existsSync(indexPath)) {
          log("Index file exists, loading...");
        } else {
          logError("Index file not found at:", indexPath);
          // Try alternative paths
          const altPaths = [
            normalize(
              path.join(
                process.resourcesPath,
                "app.asar",
                "dist",
                "index.html",
              ),
            ),
            normalize(path.join(process.resourcesPath, "dist", "index.html")),
            normalize(path.join(__dirname, "../../dist/index.html")),
            normalize(path.join(__dirname, "dist/index.html")),
          ];

          for (const altPath of altPaths) {
            log("Trying alternative path:", altPath);
            if (fs.existsSync(altPath)) {
              indexPath = altPath;
              log("Found index at alternative path:", altPath);
              break;
            }
          }
        }
      } catch (e) {
        logError("Error checking file existence:", e.message);
      }

      mainWindow.loadFile(indexPath).catch((e) => {
        logError("Failed to load index.html:", e.message);
        logError("Attempted path:", indexPath);
        dialog.showErrorBox(
          "Load Error",
          `Could not load application UI.\n\nPath: ${indexPath}\nError: ${e.message}\n\nPlease check the installation.`,
        );
      });
    }

    // Show window when ready to prevent visual flash
    mainWindow.once("ready-to-show", () => {
      log("Main window ready to show");
      mainWindow.show();
    });

    // Add debugging for window loading issues
    mainWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription, validatedURL) => {
        logError("Window failed to load:", {
          errorCode,
          errorDescription,
          validatedURL,
        });
        dialog.showErrorBox(
          "Loading Failed",
          `Failed to load the application.\n\nError: ${errorDescription}\nURL: ${validatedURL}`,
        );
      },
    );

    mainWindow.webContents.on("did-finish-load", () => {
      log("Window finished loading successfully");
      // Always open DevTools so we can debug — remove this line before shipping to customers
      mainWindow.webContents.openDevTools({ mode: "detach" });
    });

    // Enable dev tools in production for debugging this issue
    if (!isDev) {
      // DevTools opened in did-finish-load above
    }

    // Start the backend server
    startBackend();

    // Handle window closed
    mainWindow.on("closed", () => {
      mainWindow = null;
      stopBackend();
    });
  } catch (e) {
    logError("Error creating window:", e.message);
    dialog.showErrorBox("Startup Error", e.stack || e.message);
  }
}

function tryFindSystemNodeOnWindows() {
  if (!isWindows) return "node";
  const candidates = [
    process.env.NODEJS_PATH,
    "C\\\\\\\\Program Files\\\\nodejs\\\\node.exe",
    "C\\\\\\\\Program Files (x86)\\\\nodejs\\\\node.exe",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return "node"; // rely on PATH
}

function stopBackend() {
  try {
    if (!backendProcess) return;
    log("Stopping backend...", { pid: backendProcess.pid });
    backendProcess.removeAllListeners?.();
    backendProcess.kill();
    // On Windows, ensure child process tree is terminated
    if (isWindows) {
      try {
        execFile("taskkill", ["/PID", String(backendProcess.pid), "/T", "/F"], {
          windowsHide: true,
        });
      } catch (_) {}
    }
    backendProcess = null;
  } catch (e) {
    logError("Error stopping backend:", e.message);
  }
}

function startBackend() {
  const isDev = process.env.ELECTRON_IS_DEV === "true" || !app.isPackaged;

  // Create a writable data directory in user's app data
  const userDataPath = normalize(app.getPath("userData"));
  const appDataDir = normalize(path.join(userDataPath, "data"));

  // Initialize logger ASAP
  initLogger(appDataDir);
  log(
    "Platform:",
    process.platform,
    "Electron version:",
    process.versions.electron,
  );

  // Ensure the app data directory exists
  try {
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }
  } catch (e) {
    logError("Failed to create data dir:", appDataDir, e.message);
  }

  let started = false;

  if (isDev) {
    const backendPath = normalize(path.join(__dirname, "../backend/server.js"));
    const backendCwd = normalize(path.join(__dirname, "../backend"));

    log("Starting backend (dev) from:", backendPath);

    try {
      backendProcess = spawn("node", [backendPath], {
        cwd: backendCwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NODE_ENV: "development",
          PORT: "5001",
          DATA_DIR: appDataDir,
        },
        windowsHide: true,
      });
      started = true;
    } catch (e) {
      logError("Dev backend spawn error:", e.message);
    }
  } else {
    // Production: run from resources/backend (copied via extraResources)
    const resourcesPath = normalize(process.resourcesPath);
    const backendDir = normalize(path.join(resourcesPath, "backend"));
    const backendPath = normalize(path.join(backendDir, "server.js"));

    log("Backend diagnostics:", {
      resourcesPath,
      backendDirExists: fs.existsSync(backendDir),
      backendPathExists: fs.existsSync(backendPath),
      userDataPath,
      appDataDir,
      execPath: process.execPath,
    });

    log("Starting backend (prod) from:", backendPath);

    if (fs.existsSync(backendDir) && fs.existsSync(backendPath)) {
      // Prefer Electron runtime as Node (works cross-platform)
      try {
        backendProcess = spawn(process.execPath, [backendPath], {
          cwd: backendDir,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            NODE_ENV: "production",
            PORT: "5001",
            DATA_DIR: appDataDir,
          },
          windowsHide: true,
        });
        started = true;
        log("Backend started with Electron runtime", {
          pid: backendProcess.pid,
        });
      } catch (e) {
        logError("Electron runtime spawn error:", e.message);
      }

      if (!started) {
        // Fallback to system Node
        try {
          const nodeCmd = tryFindSystemNodeOnWindows();
          backendProcess = spawn(nodeCmd, [backendPath], {
            cwd: backendDir,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              ...process.env,
              NODE_ENV: "production",
              PORT: "5001",
              DATA_DIR: appDataDir,
            },
            windowsHide: true,
          });
          started = true;
          log("Backend started with system Node", {
            pid: backendProcess.pid,
            node: nodeCmd,
          });
        } catch (e2) {
          logError("System Node spawn error:", e2.message);
        }
      }
    } else {
      logError("Backend files not found in resources/backend.");
    }
  }

  if (!started) {
    logError("Backend failed to start.");
    dialog.showErrorBox(
      "Backend Error",
      "The background service failed to start. Please reinstall or contact support.",
    );
    return;
  }

  if (backendProcess) {
    backendProcess.on("error", (err) => {
      logError("Backend Spawn Error:", err.message);
    });
    backendProcess.stdout.on("data", (data) =>
      log("Backend:", data.toString().trim()),
    );
    backendProcess.stderr.on("data", (data) =>
      logError("Backend Error:", data.toString().trim()),
    );
    backendProcess.on("close", (code) =>
      log("Backend process exited", String(code)),
    );
  }
}

// Single instance lock prevents double-start on Windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// App event handlers
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for communication between renderer and main process
ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("get-platform", () => process.platform);
ipcMain.handle("show-open-dialog", async (event, options) =>
  dialog.showOpenDialog(mainWindow, options),
);
ipcMain.handle("show-save-dialog", async (event, options) =>
  dialog.showSaveDialog(mainWindow, options),
);
ipcMain.handle("show-message-box", async (event, options) =>
  dialog.showMessageBox(mainWindow, options),
);
ipcMain.handle("restart-app", () => {
  stopBackend();
  app.relaunch();
  app.exit();
});
ipcMain.handle("check-for-updates", () => ({
  updateAvailable: false,
  version: app.getVersion(),
}));

// ── Auth IPC handlers ────────────────────────────────────────────────────
ipcMain.handle("auth:login", async (_event, email, password) => {
  try {
    return await authService.login(email, password);
  } catch (err) {
    logError("auth:login error", err.message);
    return { success: false, error: "An unexpected error occurred." };
  }
});

ipcMain.handle("auth:verify", async () => {
  try {
    return await authService.verify();
  } catch (err) {
    logError("auth:verify error", err.message);
    return { success: false, locked: true, error: "Verification failed." };
  }
});

ipcMain.handle("auth:logout", async () => {
  try {
    return await authService.logout();
  } catch (err) {
    logError("auth:logout error", err.message);
    return { success: true }; // always clear locally
  }
});

ipcMain.handle("auth:hasToken", async () => {
  try {
    return await authService.hasStoredToken();
  } catch {
    return false;
  }
});

ipcMain.handle("auth:openExternal", async (_event, url) => {
  // Only allow turbodm.pro URLs
  if (typeof url === "string" && url.startsWith("https://turbodm.pro")) {
    shell.openExternal(url);
  }
});
