#!/bin/bash

# Debug Windows Build Script
# This will create a version with extensive logging to help us debug

echo "🔍 Creating Debug Windows Build..."
echo "================================="

# Clean previous builds
rm -rf dist-electron/debug-*

# Copy current package.json for backup
cp package.json package.json.backup

# Add debug configuration to package.json
cat > debug-config.json << 'EOF'
{
  "build": {
    "extraMetadata": {
      "main": "electron/main.cjs"
    },
    "win": {
      "icon": "assets/icons/icon-large.png",
      "target": [
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    },
    "extraResources": [
      {
        "from": "backend",
        "to": "backend"
      }
    ]
  }
}
EOF

# Create debug version of main.cjs with extensive logging
cat > electron/main-debug.cjs << 'EOF'
const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

// Comprehensive error logging
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Fatal Error', `Uncaught Exception: ${error.message}\n\nStack: ${error.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  dialog.showErrorBox('Unhandled Promise Rejection', `Reason: ${reason}`);
});

function createWindow() {
  try {
    console.log("Creating main window...");
    
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, "preload.cjs"),
      },
      show: true,
      autoHideMenuBar: true,
    });

    console.log("Main window created successfully");
    
    // Load the app
    const isDev = false; // Force production mode for debug
    const indexPath = path.join(__dirname, "../dist/index.html");
    
    console.log("Loading app from:", indexPath);
    console.log("Index file exists:", fs.existsSync(indexPath));
    
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      dialog.showErrorBox('File Not Found', `Cannot find index.html at: ${indexPath}`);
    }

    // Open DevTools for debugging
    mainWindow.webContents.openDevTools();
    
    console.log("Window setup complete");
    
  } catch (error) {
    console.error("Error creating window:", error);
    dialog.showErrorBox('Window Creation Error', `Error: ${error.message}\n\nStack: ${error.stack}`);
  }
}

// App event handlers
app.whenReady().then(() => {
  console.log("App is ready, creating window...");
  createWindow();
});

app.on("window-all-closed", () => {
  console.log("All windows closed");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  console.log("App activated");
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Log app path info
console.log("App path info:", {
  __dirname,
  "process.cwd()": process.cwd(),
  "app.getAppPath()": app.getAppPath(),
  "process.resourcesPath": process.resourcesPath,
  "app.isPackaged": app.isPackaged
});
EOF

# Update package.json to use debug main
sed -i.bak 's/"main": "electron\/main.cjs"/"main": "electron\/main-debug.cjs"/' package.json

# Build debug version
echo "Building debug version..."
npm run build
npm run build-electron-win

# Rename debug build
mv "dist-electron/Instagram DM Tool 1.0.0.exe" "dist-electron/Instagram DM Tool DEBUG.exe" 2>/dev/null || true

# Restore original files
mv package.json.backup package.json
rm -f electron/main-debug.cjs debug-config.json

echo "✅ Debug build created: Instagram DM Tool DEBUG.exe"
echo "This version will show detailed error messages and keep DevTools open"
