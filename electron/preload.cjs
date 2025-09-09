const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // App information
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getPlatform: () => ipcRenderer.invoke("get-platform"),

  // Dialogs
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
  showMessageBox: (options) => ipcRenderer.invoke("show-message-box", options),

  // App controls
  restartApp: () => ipcRenderer.invoke("restart-app"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),

  // File system operations (implemented in main process)
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  writeFile: (filePath, content) =>
    ipcRenderer.invoke("write-file", filePath, content),

  // Backend communication
  backendReady: () => ipcRenderer.invoke("backend-ready"),

  // Listen for events from main process
  on: (channel, callback) => {
    const validChannels = [
      "update-available",
      "update-downloaded",
      "backend-ready",
      "backend-error",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  // Remove event listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// Also expose a simple API for development
if (process.env.NODE_ENV === "development") {
  contextBridge.exposeInMainWorld("dev", {
    platform: process.platform,
    versions: process.versions,
  });
}
