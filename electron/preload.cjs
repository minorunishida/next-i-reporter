const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  restartServer: () => ipcRenderer.invoke("settings:restart-server"),
  openFileDialog: (options) => ipcRenderer.invoke("dialog:open-file", options),
});
