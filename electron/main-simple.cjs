const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

// Better error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  try {
    dialog.showErrorBox("Application Error", `Error: ${error.message}`);
  } catch (e) {
    // If dialog fails, at least log it
    console.error("Dialog failed:", e);
  }
});

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.cjs"),
      },
      show: false,
      autoHideMenuBar: true,
    });

    // Load the frontend
    const indexPath = path.join(__dirname, "../dist/index.html");

    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      // Create a simple error page if index.html is missing
      const errorHtml = `
        <html>
          <body style="font-family: Arial; padding: 20px; text-align: center;">
            <h1>Instagram DM Tool</h1>
            <p>Loading application...</p>
            <p style="color: #666;">Path: ${indexPath}</p>
            <p style="color: #666;">App packaged: ${app.isPackaged}</p>
            <p style="color: #666;">__dirname: ${__dirname}</p>
          </body>
        </html>
      `;
      mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`
      );
    }

    // Show window when ready
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      // Open DevTools for debugging
      mainWindow.webContents.openDevTools();
    });

    // Handle window closed
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  } catch (error) {
    console.error("Window creation error:", error);
    try {
      dialog.showErrorBox(
        "Window Error",
        `Failed to create window: ${error.message}`
      );
    } catch (e) {
      console.error("Failed to show error dialog:", e);
    }
  }
}

// App ready
app.whenReady().then(() => {
  createWindow();
});

// Handle all windows closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle activate (macOS)
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Log basic info for debugging
console.log("Electron main process starting...");
console.log("App path:", app.getAppPath());
console.log("Is packaged:", app.isPackaged);
console.log("Resource path:", process.resourcesPath);
console.log("__dirname:", __dirname);
